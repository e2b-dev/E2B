import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import {
  createSecureServer,
  type Http2SecureServer,
  type ServerHttp2Session,
  type ServerHttp2Stream,
} from 'node:http2'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { createApiFetchForRuntime } from '../../src/api/http2'
import { createEnvdFetchForRuntime } from '../../src/envd/http2'
import type { UndiciModule } from '../../src/undici'
import { runtime } from '../../src/utils'

const exec = promisify(execFile)
const idleTimeout = 200

// #2008: mocked fetch tests cannot detect retained HTTP/2 sessions. Exercise
// real SDK dispatchers against loopback TLS origins, without cloud credentials.
describe.skipIf(runtime !== 'node')(
  'HTTP/2 idle connection reclamation',
  () => {
    let directory: string
    let key: Buffer
    let cert: Buffer
    let undici: typeof import('undici')
    const servers: Http2SecureServer[] = []
    const sessions = new Set<ServerHttp2Session>()
    const streams = new Set<ServerHttp2Stream>()
    const dispatchers: import('undici').Agent[] = []

    beforeAll(async () => {
      undici = await import('undici')
      directory = await mkdtemp(join(tmpdir(), 'e2b-h2-idle-'))
      const keyPath = join(directory, 'key.pem')
      const certPath = join(directory, 'cert.pem')
      await exec('openssl', [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
        '-keyout',
        keyPath,
        '-out',
        certPath,
      ])
      key = await readFile(keyPath)
      cert = await readFile(certPath)
    })

    afterEach(async () => {
      // Explicit destruction is teardown only; assertions below must observe
      // automatic reclamation before this runs, including on a failing test.
      await Promise.all(dispatchers.splice(0).map((agent) => agent.destroy()))
      for (const session of sessions) session.destroy()
      await Promise.all(
        servers
          .splice(0)
          .map(
            (server) =>
              new Promise<void>((resolve) => server.close(() => resolve()))
          )
      )
      sessions.clear()
      streams.clear()
    })

    afterAll(async () => {
      if (directory) await rm(directory, { recursive: true, force: true })
    })

    async function origin() {
      const server = createSecureServer({ key, cert })
      servers.push(server)
      server.on('session', (session) => {
        sessions.add(session)
        session.on('error', () => {})
        session.on('close', () => sessions.delete(session))
      })
      server.on('stream', (stream, headers) => {
        streams.add(stream)
        stream.on('error', () => {})
        stream.on('close', () => streams.delete(stream))
        stream.respond({ ':status': 200, 'content-type': 'text/plain' })
        if (headers[':path'] === '/stream') stream.write('first chunk')
        else stream.end('ok')
      })
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
      )
      return `https://127.0.0.1:${(server.address() as AddressInfo).port}`
    }

    function loadUndici(): Promise<UndiciModule> {
      class Agent extends undici.Agent {
        constructor(options: ConstructorParameters<UndiciModule['Agent']>[0]) {
          super({
            ...options,
            connect: { ca: cert },
            keepAliveTimeout: idleTimeout,
          })
          dispatchers.push(this)
        }
      }
      return Promise.resolve({ ...undici, Agent })
    }

    async function reclaimed() {
      await expect.poll(() => streams.size, { timeout: 5_000 }).toBe(0)
      await expect.poll(() => sessions.size, { timeout: 5_000 }).toBe(0)
    }

    test.each([
      ['envd', createEnvdFetchForRuntime],
      ['API', createApiFetchForRuntime],
    ] as const)(
      '%s fetch reuses connections and reclaims every idle origin',
      async (_name, createFetch) => {
        const urls = await Promise.all([origin(), origin(), origin()])
        const fetcher = createFetch('node', { connectionLimit: 1, loadUndici })
        for (let cycle = 0; cycle < 3; cycle++) {
          await Promise.all(
            urls.map(async (url) => {
              expect(await (await fetcher(url)).text()).toBe('ok')
              const session = [...sessions].find(
                (s) => s.socket.localPort === Number(new URL(url).port)
              )
              expect(session).toBeDefined()
              expect(await (await fetcher(url)).text()).toBe('ok')
              expect(sessions.has(session!)).toBe(true)
            })
          )
          expect(dispatchers).toHaveLength(1)
          await reclaimed()
        }
      }
    )

    test('keeps a quiet response stream alive and reclaims it after cancellation', async () => {
      const url = await origin()
      const fetcher = createEnvdFetchForRuntime('node', {
        connectionLimit: 1,
        loadUndici,
      })
      const response = await fetcher(`${url}/stream`)
      const reader = response.body!.getReader()
      expect((await reader.read()).done).toBe(false)

      // A quiet but unfinished stream is not an idle connection. It must also
      // survive another multiplexed request completing on the same session.
      expect(await (await fetcher(url)).text()).toBe('ok')
      await delay(idleTimeout * 3)
      expect(sessions.size).toBe(1)
      expect(streams.size).toBe(1)

      await reader.cancel()
      await reclaimed()
      expect(await (await fetcher(url)).text()).toBe('ok')
      await reclaimed()
    })

    test('reclaims a response stream after its request is aborted', async () => {
      const url = await origin()
      const fetcher = createEnvdFetchForRuntime('node', {
        connectionLimit: 1,
        loadUndici,
      })
      const controller = new AbortController()
      const response = await fetcher(`${url}/stream`, {
        signal: controller.signal,
      })
      const reader = response.body!.getReader()
      await reader.read()
      const reading = expect(reader.read()).rejects.toThrow()
      controller.abort()
      await reading
      await reclaimed()
    })
  }
)
