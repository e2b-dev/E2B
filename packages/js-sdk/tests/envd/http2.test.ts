import http2 from 'node:http2'
import { AddressInfo } from 'node:net'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createEnvdFetch } from '../../src/envd/http2'

let server: http2.Http2Server | undefined
let serverSessions: Set<http2.ServerHttp2Session>

async function startServer(
  handle: (
    stream: http2.ServerHttp2Stream,
    headers: http2.IncomingHttpHeaders
  ) => void
) {
  server = http2.createServer()
  server.on('session', (session) => {
    serverSessions.add(session)
    session.once('close', () => serverSessions.delete(session))
  })
  server.on('stream', handle)
  await new Promise<void>((resolve) => server!.listen(0, resolve))
  const address = server.address() as AddressInfo

  return `http://127.0.0.1:${address.port}`
}

beforeEach(() => {
  server = undefined
  serverSessions = new Set()
})

afterEach(async () => {
  vi.restoreAllMocks()
  if (!server) {
    return
  }

  serverSessions.forEach((session) => session.destroy())
  await new Promise<void>((resolve, reject) => {
    server!.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
})

test('uses HTTP/2 in Node', async () => {
  const origin = await startServer((stream, headers) => {
    expect(headers[':method']).toBe('GET')
    stream.respond({ ':status': 200, 'content-type': 'application/json' })
    stream.end(JSON.stringify({ protocol: 'h2' }))
  })

  const res = await createEnvdFetch('node')(`${origin}/status`)

  expect(res.status).toBe(200)
  await expect(res.json()).resolves.toEqual({ protocol: 'h2' })
})

test('uses global fetch outside Node', () => {
  const originalFetch = globalThis.fetch
  const fallbackFetch = vi.fn() as unknown as typeof fetch
  globalThis.fetch = fallbackFetch

  expect(createEnvdFetch('browser')).toBe(fallbackFetch)
  expect(createEnvdFetch('vercel-edge')).toBe(fallbackFetch)

  globalThis.fetch = originalFetch
})

test('rejects aborted requests', async () => {
  const origin = await startServer(() => undefined)
  const controller = new AbortController()
  const promise = createEnvdFetch('node')(`${origin}/wait`, {
    signal: controller.signal,
  })

  controller.abort()

  await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
})

test('body cancel is safe', async () => {
  const origin = await startServer((stream) => {
    stream.respond({ ':status': 200 })
    stream.write('chunk')
  })

  const res = await createEnvdFetch('node')(`${origin}/stream`)

  await expect(res.body!.cancel()).resolves.toBeUndefined()
})
