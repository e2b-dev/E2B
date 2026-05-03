import http2 from 'node:http2'
import { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createEnvdFetchForRuntime } from '../../src/envd/http2'

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

  const res = await createEnvdFetchForRuntime('node')(`${origin}/status`)

  expect(res.status).toBe(200)
  await expect(res.json()).resolves.toEqual({ protocol: 'h2' })
})

test('uses global fetch outside Node', () => {
  const originalFetch = globalThis.fetch
  const fallbackFetch = vi.fn() as unknown as typeof fetch
  globalThis.fetch = fallbackFetch

  expect(createEnvdFetchForRuntime('browser')).toBe(fallbackFetch)
  expect(createEnvdFetchForRuntime('vercel-edge')).toBe(fallbackFetch)

  globalThis.fetch = originalFetch
})

test('rejects aborted requests', async () => {
  const origin = await startServer(() => undefined)
  const controller = new AbortController()
  const promise = createEnvdFetchForRuntime('node')(`${origin}/wait`, {
    signal: controller.signal,
  })

  controller.abort()

  await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
})

test('follows redirects', async () => {
  const origin = await startServer((stream, headers) => {
    if (headers[':path'] === '/redirect') {
      stream.respond({ ':status': 302, location: '/done' })
      stream.end()
      return
    }

    stream.respond({ ':status': 200 })
    stream.end('ok')
  })

  const res = await createEnvdFetchForRuntime('node')(`${origin}/redirect`)

  expect(res.status).toBe(200)
  await expect(res.text()).resolves.toBe('ok')
})

test('rejects redirects when redirect mode is error', async () => {
  const origin = await startServer((stream) => {
    stream.respond({ ':status': 302, location: '/done' })
    stream.end()
  })

  const res = createEnvdFetchForRuntime('node')(`${origin}/redirect`, {
    redirect: 'error',
  })

  await expect(res).rejects.toThrow(TypeError)
})

test('aborts streaming response bodies', async () => {
  const origin = await startServer((stream) => {
    stream.respond({ ':status': 200 })
    stream.write('chunk')
  })
  const controller = new AbortController()
  const res = await createEnvdFetchForRuntime('node')(`${origin}/stream`, {
    signal: controller.signal,
  })

  controller.abort()

  await expect(res.text()).rejects.toMatchObject({ name: 'AbortError' })
})

test('body cancel is safe', async () => {
  const origin = await startServer((stream) => {
    stream.respond({ ':status': 200 })
    stream.write('chunk')
  })

  const res = await createEnvdFetchForRuntime('node')(`${origin}/stream`)

  await expect(res.body!.cancel()).resolves.toBeUndefined()
})

test('decodes gzip responses', async () => {
  const origin = await startServer((stream) => {
    stream.respond({ ':status': 200, 'content-encoding': 'gzip' })
    stream.end(gzipSync('compressed'))
  })

  const res = await createEnvdFetchForRuntime('node')(`${origin}/gzip`)

  expect(res.headers.has('content-encoding')).toBe(false)
  await expect(res.text()).resolves.toBe('compressed')
})

test('pauses streaming response bodies when the reader is behind', async () => {
  const calls = { pause: 0, resume: 0 }
  const connect = http2.connect
  vi.spyOn(http2, 'connect').mockImplementation((...args) => {
    const session = connect(...args)
    const request = session.request.bind(session)
    vi.spyOn(session, 'request').mockImplementation((...requestArgs) => {
      const stream = request(...requestArgs)
      const pause = stream.pause.bind(stream)
      const resume = stream.resume.bind(stream)
      vi.spyOn(stream, 'pause').mockImplementation(() => {
        calls.pause += 1
        return pause()
      })
      vi.spyOn(stream, 'resume').mockImplementation(() => {
        calls.resume += 1
        return resume()
      })

      return stream
    })

    return session
  })
  const origin = await startServer((stream) => {
    stream.respond({ ':status': 200 })
    stream.write('first')
    stream.write('second')
    setTimeout(() => stream.end(), 20)
  })

  const res = await createEnvdFetchForRuntime('node')(`${origin}/stream`)
  await new Promise((resolve) => setTimeout(resolve, 10))

  expect(calls.pause).toBeGreaterThan(0)
  await expect(res.text()).resolves.toBe('firstsecond')
  expect(calls.resume).toBeGreaterThan(0)
})

test('keeps session open while response body is streaming', async () => {
  const origin = await startServer((stream) => {
    stream.respond({ ':status': 200 })
    stream.write('start')
    setTimeout(() => {
      stream.end('end')
    }, 50)
  })

  const envdFetch = createEnvdFetchForRuntime('node', {
    idleSessionTimeoutMs: 10,
  })
  const res = await envdFetch(`${origin}/stream`)

  await expect(res.text()).resolves.toBe('startend')
})
