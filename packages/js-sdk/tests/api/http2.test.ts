import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  vi.doUnmock('undici')
  vi.doUnmock('../../src/utils')
  delete process.env.E2B_API_CONNECTIONS
  delete process.env.E2B_API_INFLIGHT_REQUESTS
})

test('uses undici with a bounded HTTP/2 dispatcher for API requests', async () => {
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
  const loadUndici = vi.fn(() => Promise.resolve({ Agent, fetch: undiciFetch }))

  const { createApiFetchForRuntime } = await import('../../src/api/http2')

  const fetcher = createApiFetchForRuntime('node', {
    connectionLimit: 100,
    loadUndici,
  })
  await fetcher('https://example.com/sandboxes')

  expect(loadUndici).toHaveBeenCalledOnce()
  expect(agents).toEqual([{ allowH2: true, connections: 100 }])
  expect(requests[0].init?.dispatcher).toBeInstanceOf(Agent)
})

test('retries a graceful HTTP/2 GOAWAY once for API GET requests', async () => {
  class Agent {}
  const goAway = Object.assign(
    new Error('HTTP/2: "GOAWAY" frame received with code 0'),
    { code: 'UND_ERR_SOCKET' }
  )
  const undiciFetch = vi
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new TypeError('fetch failed'), { cause: goAway })
    )
    .mockResolvedValueOnce(new Response('ok'))

  const { createApiFetchForRuntime } = await import('../../src/api/http2')
  const fetcher = createApiFetchForRuntime('node', {
    loadUndici: () => Promise.resolve({ Agent, fetch: undiciFetch }),
  })

  expect(await (await fetcher('https://example.com/sandboxes')).text()).toBe(
    'ok'
  )
  expect(undiciFetch).toHaveBeenCalledTimes(2)
})

test('leaves graceful GOAWAY handling to Undici 8', async () => {
  class Agent {}
  const goAway = Object.assign(
    new Error('HTTP/2: "GOAWAY" frame received with code 0'),
    { code: 'UND_ERR_SOCKET' }
  )
  const undiciFetch = vi.fn().mockRejectedValue(goAway)

  const { createApiFetchForRuntime } = await import('../../src/api/http2')
  const fetcher = createApiFetchForRuntime('node', {
    loadUndici: () =>
      Promise.resolve({
        Agent,
        fetch: undiciFetch,
        retryGracefulGoAway: false,
      }),
  })

  await expect(fetcher('https://example.com/sandboxes')).rejects.toBe(goAway)
  expect(undiciFetch).toHaveBeenCalledOnce()
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
      proxyTunnel?: boolean
    }) {
      proxyAgents.push(options)
    }
  }

  const undiciFetch = vi.fn((input, init) => {
    requests.push({ init })
    return Promise.resolve(new Response('ok'))
  })
  const loadUndici = vi.fn(() =>
    Promise.resolve({ Agent, ProxyAgent, fetch: undiciFetch })
  )

  const { createApiFetchForRuntime } = await import('../../src/api/http2')

  const fetcher = createApiFetchForRuntime('node', {
    connectionLimit: 100,
    proxy: 'http://user:pass@127.0.0.1:8080',
    loadUndici,
  })
  await fetcher('https://example.com/sandboxes')

  expect(agents).toHaveLength(0)
  expect(proxyAgents).toEqual([
    {
      uri: 'http://user:pass@127.0.0.1:8080',
      allowH2: true,
      connections: 100,
      proxyTunnel: true,
    },
  ])
  expect(requests[0].init?.dispatcher).toBeInstanceOf(ProxyAgent)
})

test('caches API fetchers per proxy', async () => {
  const { createApiFetch } = await import('../../src/api/http2')

  const noProxy = createApiFetch()
  const proxyA = createApiFetch('http://127.0.0.1:8080')
  const proxyB = createApiFetch('http://127.0.0.1:9090')

  expect(createApiFetch()).toBe(noProxy)
  expect(createApiFetch('http://127.0.0.1:8080')).toBe(proxyA)
  expect(proxyA).not.toBe(noProxy)
  expect(proxyA).not.toBe(proxyB)
})

test('getApiConnectionLimit throws on a malformed env value', async () => {
  process.env.E2B_API_CONNECTIONS = 'not-a-number'

  const { getApiConnectionLimit } = await import('../../src/api/http2')

  expect(() => getApiConnectionLimit()).toThrow(/E2B_API_CONNECTIONS/)
})

test('getApiInflightLimit throws on a malformed env value', async () => {
  process.env.E2B_API_INFLIGHT_REQUESTS = 'not-a-number'

  const { getApiInflightLimit } = await import('../../src/api/http2')

  expect(() => getApiInflightLimit()).toThrow(/E2B_API_INFLIGHT_REQUESTS/)
})

test('getApiInflightLimit returns 0 when explicitly disabled', async () => {
  process.env.E2B_API_INFLIGHT_REQUESTS = '0'

  const { getApiInflightLimit } = await import('../../src/api/http2')

  expect(getApiInflightLimit()).toBe(0)
})

test('getApiInflightLimit throws on negative env value', async () => {
  process.env.E2B_API_INFLIGHT_REQUESTS = '-5'

  const { getApiInflightLimit } = await import('../../src/api/http2')

  expect(() => getApiInflightLimit()).toThrow(/E2B_API_INFLIGHT_REQUESTS=-5/)
})
