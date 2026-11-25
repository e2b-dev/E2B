import { spawn, type ChildProcess } from 'node:child_process'
import * as net from 'node:net'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Sandbox } from 'e2b'
import WebSocket from 'ws'
import { isDebug } from '../../setup'
import { websocketPortFor } from '../../../src/commands/sandbox/port_forward_helpers'

const domain = process.env.E2B_DOMAIN || 'e2b.app'
const apiKey = process.env.E2B_API_KEY
const integrationTest = test.skipIf(!apiKey || isDebug)
const cliPath = path.join(process.cwd(), 'dist', 'index.js')

function startPortForward(sandboxId: string, mapping: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2B_DOMAIN: domain,
    E2B_API_KEY: apiKey,
  }
  delete env.E2B_DEBUG
  const child = spawn(
    'node',
    [cliPath, 'sandbox', 'port-forward', sandboxId, mapping],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  const ready = new Promise<void>((resolve, reject) => {
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
      if (output.includes('Forwarding')) resolve()
    })
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('exit', (code) =>
      reject(new Error(`port-forward exited with ${code}: ${output}`))
    )
  })
  return { child, ready }
}

describe('sandbox port-forward', () => {
  let sandbox: Sandbox
  const children: ChildProcess[] = []

  beforeAll(async () => {
    if (!apiKey || isDebug) return
    sandbox = await Sandbox.create('base', {
      apiKey,
      domain,
      timeoutMs: 120_000,
      network: { allowPublicTraffic: false },
    })
    await sandbox.files.write('/tmp/www/hello.txt', 'hello from sandbox')
    await sandbox.commands.run('python3 -m http.server 3000', {
      cwd: '/tmp/www',
      background: true,
      timeoutMs: 0,
    })
  }, 60_000)

  afterAll(async () => {
    children.forEach((child) => child.kill())
    await sandbox?.kill()
  })

  integrationTest(
    'forwards a local port to a sandbox port',
    { timeout: 90_000 },
    async () => {
      const first = startPortForward(sandbox.sandboxId, '13579:3000')
      children.push(first.child)
      await first.ready

      const res = await fetch('http://127.0.0.1:13579/hello.txt')
      expect(await res.text()).toBe('hello from sandbox')

      // The client half-closes after its request and still gets the reply.
      const halfClosed = await new Promise<string>((resolve, reject) => {
        let reply = ''
        const client = net.connect(13579, '127.0.0.1', () =>
          client.end('GET /hello.txt HTTP/1.0\r\n\r\n')
        )
        client.on('data', (chunk) => (reply += chunk))
        client.on('close', () => resolve(reply))
        client.on('error', reject)
      })
      expect(halfClosed).toContain('hello from sandbox')

      // Without the secret path, websocat refuses the WebSocket upgrade even
      // with the traffic access token.
      const status = await new Promise<number | undefined>((resolve) => {
        const ws = new WebSocket(
          `wss://${sandbox.getHost(websocketPortFor(3000))}/`,
          {
            headers: {
              'e2b-traffic-access-token': sandbox.trafficAccessToken!,
            },
          }
        )
        ws.on('unexpected-response', (_req, res) => resolve(res.statusCode))
        ws.on('open', () => {
          ws.terminate()
          resolve(101)
        })
        ws.on('error', () => resolve(undefined))
      })
      expect(status).toBe(400)

      const second = startPortForward(sandbox.sandboxId, '13580:3000')
      children.push(second.child)
      await second.ready

      const reused = await fetch('http://127.0.0.1:13580/hello.txt')
      expect(await reused.text()).toBe('hello from sandbox')

      // Windows has no catchable SIGINT for child processes: kill() terminates
      // the CLI before it can stop websocat.
      if (process.platform === 'win32') return

      const secondExit = new Promise((resolve) =>
        second.child.once('exit', resolve)
      )
      await new Promise((resolve) => {
        first.child.once('exit', resolve)
        first.child.kill('SIGINT')
      })
      await secondExit

      const processes = await sandbox.commands.list()
      expect(processes.some((p) => p.args.join(' ').includes('websocat'))).toBe(false)
    }
  )
})
