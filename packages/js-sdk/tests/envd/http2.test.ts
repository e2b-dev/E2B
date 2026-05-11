import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  vi.doUnmock('undici')
  vi.doUnmock('../../src/utils')
})

test('uses undici with HTTP/2 enabled in Node', async () => {
  const agents: Array<{ allowH2?: boolean; connections?: number }> = []
  const requests: Array<{ init?: RequestInit & { dispatcher?: unknown } }> = []

  class Agent {
    constructor(options: { allowH2?: boolean; connections?: number }) {
      agents.push(options)
    }
  }

  const undiciFetch = vi.fn((input, init) => {
    requests.push({ init })
    return Promise.resolve(new Response('ok'))
  })

  const { createEnvdFetchForRuntime } = await import('../../src/envd/http2')

  const fetcher = createEnvdFetchForRuntime('node', {
    connectionLimit: 1,
    loadUndici: () => Promise.resolve({ Agent, fetch: undiciFetch }),
  })
  const res = await fetcher('https://example.com/status')

  expect(await res.text()).toBe('ok')
  expect(agents).toEqual([{ allowH2: true, connections: 1 }])
  expect(requests[0].init?.dispatcher).toBeInstanceOf(Agent)
})

test('passes Request objects to undici as URL plus init', async () => {
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []

  class Agent {}

  const undiciFetch = vi.fn((input, init) => {
    requests.push({ input, init })
    return Promise.resolve(new Response('ok'))
  })

  const { createEnvdFetchForRuntime } = await import('../../src/envd/http2')

  const fetcher = createEnvdFetchForRuntime('node', {
    connectionLimit: 1,
    loadUndici: () => Promise.resolve({ Agent, fetch: undiciFetch }),
  })
  const body = JSON.stringify({ ok: true })
  await fetcher(
    new Request('https://example.com/rpc', {
      body,
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
  )

  expect(requests[0].input).toBe('https://example.com/rpc')
  expect(requests[0].init?.method).toBe('POST')
  expect(requests[0].init?.headers).toBeInstanceOf(Headers)
  expect(requests[0].init?.body).toBeInstanceOf(ReadableStream)
})

test('can create an uncapped dispatcher for RPC streams', async () => {
  const agents: Array<{ allowH2?: boolean; connections?: number }> = []

  class Agent {
    constructor(options: { allowH2?: boolean; connections?: number }) {
      agents.push(options)
    }
  }

  const undiciFetch = vi.fn(() => Promise.resolve(new Response('ok')))

  const { createEnvdFetchForRuntime } = await import('../../src/envd/http2')

  const fetcher = createEnvdFetchForRuntime('node', {
    loadUndici: () => Promise.resolve({ Agent, fetch: undiciFetch }),
  })
  await fetcher('https://example.com/rpc')

  expect(agents).toEqual([{ allowH2: true }])
})

test('defers loading undici until the first Node request', async () => {
  const Agent = vi.fn()
  const undiciFetch = vi.fn(() => Promise.resolve(new Response('ok')))
  const loadUndici = vi.fn(() => Promise.resolve({ Agent, fetch: undiciFetch }))

  const { createEnvdFetchForRuntime } = await import('../../src/envd/http2')

  const fetcher = createEnvdFetchForRuntime('node', {
    connectionLimit: 1,
    loadUndici,
  })

  expect(loadUndici).not.toHaveBeenCalled()
  expect(Agent).not.toHaveBeenCalled()
  expect(undiciFetch).not.toHaveBeenCalled()

  await fetcher('https://example.com/status')

  expect(loadUndici).toHaveBeenCalledOnce()
  expect(Agent).toHaveBeenCalledOnce()
  expect(undiciFetch).toHaveBeenCalledOnce()
})

test('falls back to global fetch when undici cannot be loaded', async () => {
  const fallbackFetch = vi.fn(() =>
    Promise.resolve(new Response('fallback ok'))
  ) as unknown as typeof fetch
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', fallbackFetch)

  const { createEnvdFetchForRuntime } = await import('../../src/envd/http2')

  const fetcher = createEnvdFetchForRuntime('node', {
    loadUndici: () => Promise.resolve(undefined),
  })
  const res = await fetcher('https://example.com/status')

  expect(await res.text()).toBe('fallback ok')
  expect(fallbackFetch).toHaveBeenCalledWith(
    'https://example.com/status',
    undefined
  )
  expect(warn).toHaveBeenCalledOnce()
})

test('uses global fetch outside Node', async () => {
  const fallbackFetch = vi.fn() as unknown as typeof fetch
  vi.stubGlobal('fetch', fallbackFetch)

  const { createEnvdFetchForRuntime } = await import('../../src/envd/http2')

  expect(createEnvdFetchForRuntime('browser')).toBe(fallbackFetch)
  expect(createEnvdFetchForRuntime('vercel-edge')).toBe(fallbackFetch)
})
