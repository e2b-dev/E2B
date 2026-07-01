import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  vi.doUnmock('undici')
  vi.doUnmock('../../src/utils')
  delete process.env.E2B_ENVD_CONNECTIONS
  delete process.env.E2B_ENVD_RPC_CONNECTIONS
  delete process.env.E2B_ENVD_INFLIGHT_REQUESTS
  delete process.env.E2B_ENVD_RPC_INFLIGHT_REQUESTS
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

test('uses a ProxyAgent dispatcher when a proxy is configured', async () => {
  const proxyAgents: Array<{
    uri?: string
    allowH2?: boolean
    connections?: number
  }> = []
  const agents: Array<unknown> = []
  const requests: Array<{ init?: RequestInit & { dispatcher?: unknown } }> = []

  class Agent {
    constructor() {
      agents.push(this)
    }
  }

  class ProxyAgent {
    constructor(options: {
      uri?: string
      allowH2?: boolean
      connections?: number
    }) {
      proxyAgents.push(options)
    }
  }

  const undiciFetch = vi.fn((input, init) => {
    requests.push({ init })
    return Promise.resolve(new Response('ok'))
  })

  const { createEnvdFetchForRuntime } = await import('../../src/envd/http2')

  const fetcher = createEnvdFetchForRuntime('node', {
    connectionLimit: 1,
    proxy: 'http://127.0.0.1:8080',
    loadUndici: () =>
      Promise.resolve({ Agent, ProxyAgent, fetch: undiciFetch }),
  })
  await fetcher('https://example.com/status')

  expect(agents).toHaveLength(0)
  expect(proxyAgents).toEqual([
    { uri: 'http://127.0.0.1:8080', allowH2: true, connections: 1 },
  ])
  expect(requests[0].init?.dispatcher).toBeInstanceOf(ProxyAgent)
})

test('caches envd fetchers per proxy', async () => {
  const { createEnvdFetch, createEnvdRpcFetch } = await import(
    '../../src/envd/http2'
  )

  const noProxy = createEnvdFetch()
  const proxyA = createEnvdFetch('http://127.0.0.1:8080')

  expect(createEnvdFetch()).toBe(noProxy)
  expect(createEnvdFetch('http://127.0.0.1:8080')).toBe(proxyA)
  expect(proxyA).not.toBe(noProxy)

  const rpcNoProxy = createEnvdRpcFetch()
  const rpcProxyA = createEnvdRpcFetch('http://127.0.0.1:8080')

  expect(createEnvdRpcFetch()).toBe(rpcNoProxy)
  expect(createEnvdRpcFetch('http://127.0.0.1:8080')).toBe(rpcProxyA)
  expect(rpcProxyA).not.toBe(rpcNoProxy)
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

test('can create a bounded dispatcher for RPC streams', async () => {
  const agents: Array<{ allowH2?: boolean; connections?: number }> = []

  class Agent {
    constructor(options: { allowH2?: boolean; connections?: number }) {
      agents.push(options)
    }
  }

  const undiciFetch = vi.fn(() => Promise.resolve(new Response('ok')))

  const { createEnvdFetchForRuntime } = await import('../../src/envd/http2')

  const fetcher = createEnvdFetchForRuntime('node', {
    connectionLimit: 100,
    loadUndici: () => Promise.resolve({ Agent, fetch: undiciFetch }),
  })
  await fetcher('https://example.com/rpc')

  expect(agents).toEqual([{ allowH2: true, connections: 100 }])
})

test('reads envd connection limit from env', async () => {
  process.env.E2B_ENVD_CONNECTIONS = '50'

  const { getEnvdConnectionLimit } = await import('../../src/envd/http2')

  expect(getEnvdConnectionLimit()).toBe(50)
})

test('getEnvdConnectionLimit throws on malformed env value', async () => {
  process.env.E2B_ENVD_CONNECTIONS = 'bogus'

  const { getEnvdConnectionLimit } = await import('../../src/envd/http2')

  expect(() => getEnvdConnectionLimit()).toThrow(/E2B_ENVD_CONNECTIONS/)
})

test('reads RPC stream dispatcher connection limit from env', async () => {
  process.env.E2B_ENVD_RPC_CONNECTIONS = '200'

  const { getEnvdRpcConnectionLimit } = await import('../../src/envd/http2')

  expect(getEnvdRpcConnectionLimit()).toBe(200)
})

test('getEnvdRpcConnectionLimit throws on malformed env value', async () => {
  process.env.E2B_ENVD_RPC_CONNECTIONS = 'bogus'

  const { getEnvdRpcConnectionLimit } = await import('../../src/envd/http2')

  expect(() => getEnvdRpcConnectionLimit()).toThrow(/E2B_ENVD_RPC_CONNECTIONS/)
})

test('getEnvdInflightLimit throws on malformed env value', async () => {
  process.env.E2B_ENVD_INFLIGHT_REQUESTS = 'bogus'

  const { getEnvdInflightLimit } = await import('../../src/envd/http2')

  expect(() => getEnvdInflightLimit()).toThrow(/E2B_ENVD_INFLIGHT_REQUESTS/)
})

test('getEnvdRpcInflightLimit throws on malformed env value', async () => {
  process.env.E2B_ENVD_RPC_INFLIGHT_REQUESTS = 'bogus'

  const { getEnvdRpcInflightLimit } = await import('../../src/envd/http2')

  expect(() => getEnvdRpcInflightLimit()).toThrow(
    /E2B_ENVD_RPC_INFLIGHT_REQUESTS/
  )
})

test('inflight limit env vars return 0 when explicitly disabled', async () => {
  process.env.E2B_ENVD_INFLIGHT_REQUESTS = '0'
  process.env.E2B_ENVD_RPC_INFLIGHT_REQUESTS = '0'

  const { getEnvdInflightLimit, getEnvdRpcInflightLimit } = await import(
    '../../src/envd/http2'
  )

  expect(getEnvdInflightLimit()).toBe(0)
  expect(getEnvdRpcInflightLimit()).toBe(0)
})

test('getEnvdInflightLimit throws on negative env value', async () => {
  process.env.E2B_ENVD_INFLIGHT_REQUESTS = '-1'

  const { getEnvdInflightLimit } = await import('../../src/envd/http2')

  expect(() => getEnvdInflightLimit()).toThrow(/E2B_ENVD_INFLIGHT_REQUESTS=-1/)
})

test('getEnvdRpcInflightLimit throws on negative env value', async () => {
  process.env.E2B_ENVD_RPC_INFLIGHT_REQUESTS = '-5'

  const { getEnvdRpcInflightLimit } = await import('../../src/envd/http2')

  expect(() => getEnvdRpcInflightLimit()).toThrow(
    /E2B_ENVD_RPC_INFLIGHT_REQUESTS=-5/
  )
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
})

test('uses global fetch outside Node', async () => {
  const fallbackFetch = vi.fn() as unknown as typeof fetch
  vi.stubGlobal('fetch', fallbackFetch)

  const { createEnvdFetchForRuntime } = await import('../../src/envd/http2')

  expect(createEnvdFetchForRuntime('browser')).toBe(fallbackFetch)
  expect(createEnvdFetchForRuntime('vercel-edge')).toBe(fallbackFetch)
})
