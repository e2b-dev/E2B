import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  vi.doUnmock('undici')
  vi.doUnmock('../../src/utils')
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
