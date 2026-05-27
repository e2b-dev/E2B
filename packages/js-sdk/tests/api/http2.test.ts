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
