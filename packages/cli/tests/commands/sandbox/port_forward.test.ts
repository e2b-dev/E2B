import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Sandbox } from 'e2b'
import { isDebug } from '../../setup'

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

      const second = startPortForward(sandbox.sandboxId, '13580:3000')
      children.push(second.child)
      await second.ready

      const reused = await fetch('http://127.0.0.1:13580/hello.txt')
      expect(await reused.text()).toBe('hello from sandbox')

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
