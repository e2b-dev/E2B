import { afterEach, expect, test, vi } from 'vitest'

import { runtime } from '../../src/utils'

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

test('retries the fetcher build after a failed load instead of caching the rejection', async () => {
  const Agent = vi.fn()
  const undiciFetch = vi.fn(() => Promise.resolve(new Response('ok')))
  const loadUndici = vi
    .fn<() => Promise<unknown>>()
    .mockRejectedValueOnce(new Error('transient import failure'))
    .mockResolvedValue({ Agent, fetch: undiciFetch })

  const { createApiFetchForRuntime } = await import('../../src/api/http2')

  const fetcher = createApiFetchForRuntime('node', {
    connectionLimit: 1,
    loadUndici: loadUndici as never,
  })

  await expect(fetcher('https://example.com/sandboxes')).rejects.toThrow(
    'transient import failure'
  )

  const res = await fetcher('https://example.com/sandboxes')
  expect(await res.text()).toBe('ok')
  expect(loadUndici).toHaveBeenCalledTimes(2)
})

test('late-binds the global fetch fallback when undici cannot be loaded', async () => {
  const { createApiFetchForRuntime } = await import('../../src/api/http2')

  const fetcher = createApiFetchForRuntime('node', {
    loadUndici: () => Promise.resolve(undefined),
  })

  const firstFetch = vi.fn(() => Promise.resolve(new Response('first')))
  vi.stubGlobal('fetch', firstFetch)
  try {
    expect(await (await fetcher('https://example.com/sandboxes')).text()).toBe(
      'first'
    )

    // A fetch swapped in after the fallback was built (msw, instrumentation)
    // must still be picked up.
    const secondFetch = vi.fn(() => Promise.resolve(new Response('second')))
    vi.stubGlobal('fetch', secondFetch)

    expect(await (await fetcher('https://example.com/sandboxes')).text()).toBe(
      'second'
    )
    expect(firstFetch).toHaveBeenCalledOnce()
    expect(secondFetch).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})

test('caches API fetchers per proxy', async () => {
  const { createApiFetch } = await import('../../src/api/http2')

  const plain = createApiFetch()
  const proxyA = createApiFetch({ proxy: 'http://127.0.0.1:8080' })
  const proxyB = createApiFetch({ proxy: 'http://127.0.0.1:9090' })

  expect(createApiFetch()).toBe(plain)
  expect(createApiFetch({ proxy: 'http://127.0.0.1:8080' })).toBe(proxyA)
  expect(proxyA).not.toBe(plain)
  expect(proxyA).not.toBe(proxyB)
})

// A CA bundle is Node-only: elsewhere the factory rejects it outright.
test.skipIf(runtime !== 'node')(
  'caches API fetchers per CA bundle',
  async () => {
    const { createApiFetch } = await import('../../src/api/http2')

    const plain = createApiFetch()
    const proxied = createApiFetch({ proxy: 'http://127.0.0.1:8080' })
    const trusting = createApiFetch({ caBundle: '/etc/ssl/ca.pem' })
    const trustingOther = createApiFetch({ caBundle: '/etc/ssl/other-ca.pem' })
    const both = createApiFetch({
      proxy: 'http://127.0.0.1:8080',
      caBundle: '/etc/ssl/ca.pem',
    })

    expect(createApiFetch({ caBundle: '/etc/ssl/ca.pem' })).toBe(trusting)
    expect(trusting).not.toBe(plain)
    expect(trusting).not.toBe(trustingOther)
    expect(both).not.toBe(proxied)
    expect(both).not.toBe(trusting)
  }
)

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
