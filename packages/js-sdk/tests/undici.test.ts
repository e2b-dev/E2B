import { expect, test, vi } from 'vitest'

import {
  buildDispatchedFetch,
  createRuntimeFetch,
  isPoisonedHTTP2SessionError,
  loadUndici,
  type UndiciModule,
} from '../src/undici'
import { runtime } from '../src/utils'
import {
  foreignReadableStream,
  foreignRequestClasses,
} from './foreignPlatformObjects'

test.each(['20.20.2', '22.18.0'])(
  'does not load undici on Node %s',
  async (v) => expect(await loadUndici(v)).toBeUndefined()
)

test('a stale awaiter of a failed build does not clobber a newer successful build', async () => {
  let rejectFirstBuild: ((err: Error) => void) | undefined
  const builtFetch = vi.fn(() => Promise.resolve(new Response('ok')))
  const build = vi.fn<() => Promise<typeof fetch>>().mockImplementation(() =>
    build.mock.calls.length === 1
      ? new Promise((_, reject) => {
          rejectFirstBuild = reject
        })
      : Promise.resolve(builtFetch as unknown as typeof fetch)
  )

  const fetcher = createRuntimeFetch('node', build)

  // Interleaving: A awaits pending build P1; L (queued before P1 rejects)
  // attaches to the already-rejected P1, so its catch runs one microtask
  // after A's; C runs in between, sees the cleared cache, and installs a
  // fresh successful build that L's stale catch must not discard.
  const requestA = fetcher('https://example.com/').catch(() => 'a-failed')
  let requestL: Promise<unknown> = Promise.resolve()
  queueMicrotask(() => {
    requestL = fetcher('https://example.com/').catch(() => 'l-failed')
  })
  rejectFirstBuild?.(new Error('transient build failure'))
  let requestC: Promise<unknown> = Promise.resolve()
  queueMicrotask(() => {
    requestC = fetcher('https://example.com/')
  })

  expect(await requestA).toBe('a-failed')
  expect(await requestL).toBe('l-failed')
  await requestC

  // A later request must reuse C's cached build instead of building a third.
  await fetcher('https://example.com/')
  expect(build).toHaveBeenCalledTimes(2)
})

test('takes apart a Request the current global Request class disowns', async () => {
  const { MintingRequest, GlobalShimRequest } = foreignRequestClasses()

  const seen: Array<{ input: unknown; init?: RequestInit }> = []
  const fakeUndici = {
    Agent: class {},
    ProxyAgent: class {},
    fetch: async (input: unknown, init?: RequestInit) => {
      seen.push({ input, init })
      return new Response('ok')
    },
  } as unknown as UndiciModule

  const request = new MintingRequest('https://api.example.test/sandboxes', {
    method: 'POST',
    headers: { 'x-api-key': 'secret' },
  })

  vi.stubGlobal('Request', GlobalShimRequest)
  try {
    expect(request instanceof globalThis.Request).toBe(false)

    const fetcher = await buildDispatchedFetch({
      connections: 1,
      loadUndici: async () => fakeUndici,
    })
    await fetcher(request)
  } finally {
    vi.unstubAllGlobals()
  }

  // Handed the Request verbatim, undici coerces it to a URL string and every
  // API call dies with `Failed to parse URL from [object Request]`.
  expect(seen).toHaveLength(1)
  expect(seen[0].input).toBe('https://api.example.test/sandboxes')
  expect(seen[0].init?.method).toBe('POST')
  expect(new Headers(seen[0].init?.headers).get('x-api-key')).toBe('secret')
})

test('adopts the body of a Request from another fetch implementation', async () => {
  // A Request minted elsewhere exposes that implementation's stream as its
  // body (node-fetch hands you a Node stream, a polyfill its own class), and
  // undici stringifies those exactly like it stringifies the Request itself.
  const seen: Array<{ input: unknown; init?: RequestInit }> = []
  const fakeUndici = {
    Agent: class {},
    ProxyAgent: class {},
    fetch: async (input: unknown, init?: RequestInit) => {
      seen.push({ input, init })
      return new Response('ok')
    },
  } as unknown as UndiciModule

  const foreignRequest = {
    url: 'https://api.example.test/files',
    method: 'POST',
    headers: new Headers({ 'content-type': 'application/octet-stream' }),
    body: foreignReadableStream([
      new TextEncoder().encode('hel'),
      new TextEncoder().encode('lo'),
    ]),
    clone() {
      return this
    },
  }

  const fetcher = await buildDispatchedFetch({
    connections: 1,
    loadUndici: async () => fakeUndici,
  })
  await fetcher(foreignRequest as unknown as Request)

  expect(seen).toHaveLength(1)
  expect(seen[0].input).toBe('https://api.example.test/files')
  // Whatever arrives has to be something the platform can read; verbatim, it
  // would have been sent as the text "[object ReadableStream]".
  expect(await new Response(seen[0].init?.body).text()).toBe('hello')
})

// loadUndici is only reached in production when the runtime is Node; other
// runtimes (Bun, Deno) use their global fetch instead.
test.skipIf(runtime !== 'node')(
  'loads a real undici module at runtime on Node',
  async () => {
    const undici = await loadUndici()

    expect(undici).toBeDefined()
    expect(typeof undici?.fetch).toBe('function')
    expect(typeof undici?.Agent).toBe('function')
  }
)

// The end of the story the fake undici above can only imply: real undici,
// asked to send a Request it did not mint, throws before touching the network.
test.skipIf(runtime !== 'node')(
  'sends a disowned Request through the real undici fetch',
  async () => {
    const undici = (await loadUndici()) as UndiciModule & {
      MockAgent: new (options: { connections?: number }) => {
        get(origin: string): {
          intercept(options: {
            path: string
            method: string
            headers: Record<string, string>
          }): { reply(status: number, body: string): void }
        }
        disableNetConnect(): void
        assertNoPendingInterceptors(): void
        close(): Promise<void>
      }
    }
    const mockAgent = new undici.MockAgent({ connections: 1 })
    mockAgent.disableNetConnect()
    // An unmatched request throws, so this is the assertion: real undici has to
    // see the method, path and headers of the Request it was handed.
    mockAgent
      .get('https://api.example.test')
      .intercept({
        path: '/sandboxes',
        method: 'POST',
        headers: { 'x-api-key': 'secret' },
      })
      .reply(201, 'created')

    const { MintingRequest, GlobalShimRequest } = foreignRequestClasses()
    const request = new MintingRequest('https://api.example.test/sandboxes', {
      method: 'POST',
      headers: { 'x-api-key': 'secret' },
    })

    vi.stubGlobal('Request', GlobalShimRequest)
    try {
      const fetcher = await buildDispatchedFetch({
        connections: 1,
        loadUndici: async () => ({
          ...undici,
          // buildDispatchedFetch builds its own dispatcher; hand it the mock.
          Agent: class {
            constructor() {
              return mockAgent
            }
          } as unknown as UndiciModule['Agent'],
        }),
      })

      const response = await fetcher(request)
      expect(response.status).toBe(201)
      expect(await response.text()).toBe('created')
    } finally {
      vi.unstubAllGlobals()
      mockAgent.assertNoPendingInterceptors()
      await mockAgent.close()
    }
  }
)

function poisonedSessionError(rst = 'NGHTTP2_ENHANCE_YOUR_CALM'): TypeError {
  return new TypeError('fetch failed', {
    cause: Object.assign(new Error(`Stream closed with error code ${rst}`), {
      code: 'ERR_HTTP2_STREAM_ERROR',
    }),
  })
}

test.each([
  ['NGHTTP2_ENHANCE_YOUR_CALM', true],
  ['NGHTTP2_INTERNAL_ERROR', true],
  ['NGHTTP2_CANCEL', false],
  ['NGHTTP2_REFUSED_STREAM', false],
])('isPoisonedHTTP2SessionError on a %s stream reset is %s', (rst, poisoned) =>
  expect(isPoisonedHTTP2SessionError(poisonedSessionError(rst))).toBe(poisoned)
)

test('isPoisonedHTTP2SessionError ignores other transport failures', () => {
  expect(
    isPoisonedHTTP2SessionError(
      new TypeError('fetch failed', {
        cause: Object.assign(new Error('read ECONNRESET'), {
          code: 'ECONNRESET',
        }),
      })
    )
  ).toBe(false)
  expect(isPoisonedHTTP2SessionError(new TypeError('fetch failed'))).toBe(false)
  expect(isPoisonedHTTP2SessionError('fetch failed')).toBe(false)
})

function fakeUndiciWithDispatchers(responses: Array<() => Promise<Response>>) {
  const agents: Array<{ options: unknown; close: ReturnType<typeof vi.fn> }> =
    []
  const dispatched: unknown[] = []

  class Agent {
    close = vi.fn(() => Promise.resolve())
    constructor(options: unknown) {
      agents.push({ options, close: this.close })
    }
  }

  const undici = {
    Agent,
    ProxyAgent: class extends Agent {},
    fetch: (_input: unknown, init?: { dispatcher?: unknown }) => {
      dispatched.push(init?.dispatcher)
      return responses.shift()!()
    },
  } as unknown as UndiciModule

  return { agents, dispatched, undici }
}

test('passes maxConcurrentStreams to the dispatcher', async () => {
  const { agents, undici } = fakeUndiciWithDispatchers([
    () => Promise.resolve(new Response('ok')),
    () => Promise.resolve(new Response('ok')),
  ])

  const direct = await buildDispatchedFetch({
    connections: 10,
    maxConcurrentStreams: 1,
    loadUndici: () => Promise.resolve(undici),
  })
  await direct('https://example.com/')
  const proxied = await buildDispatchedFetch({
    connections: 10,
    maxConcurrentStreams: 1,
    proxy: 'http://127.0.0.1:8080',
    loadUndici: () => Promise.resolve(undici),
  })
  await proxied('https://example.com/')

  expect(agents.map((a) => a.options)).toEqual([
    { allowH2: true, connections: 10, maxConcurrentStreams: 1 },
    {
      uri: 'http://127.0.0.1:8080',
      allowH2: true,
      connections: 10,
      maxConcurrentStreams: 1,
      proxyTunnel: true,
    },
  ])
})

test('retires the dispatcher once after its HTTP/2 session is poisoned', async () => {
  const { agents, dispatched, undici } = fakeUndiciWithDispatchers([
    () => Promise.reject(poisonedSessionError()),
    () => Promise.reject(poisonedSessionError()),
    () => Promise.resolve(new Response('ok')),
  ])

  const fetcher = await buildDispatchedFetch({
    connections: 1,
    loadUndici: () => Promise.resolve(undici),
  })

  // Two requests in flight on the same poisoned session: both fail, the
  // dispatcher is replaced once, and the replacement is not closed in turn.
  const results = await Promise.allSettled([
    fetcher('https://example.com/a'),
    fetcher('https://example.com/b'),
  ])
  expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected'])
  expect(agents).toHaveLength(2)
  expect(agents[0].close).toHaveBeenCalledOnce()
  expect(agents[1].close).not.toHaveBeenCalled()

  const res = await fetcher('https://example.com/c')
  expect(await res.text()).toBe('ok')
  expect(dispatched).toEqual(
    [agents[0], agents[0], agents[1]].map(() => expect.any(Object))
  )
  expect(dispatched[0]).toBe(dispatched[1])
  expect(dispatched[2]).not.toBe(dispatched[0])
  expect(dispatched[2]).toBeInstanceOf(undici.Agent)
})

test('keeps the dispatcher on other fetch failures', async () => {
  const { agents, undici } = fakeUndiciWithDispatchers([
    () =>
      Promise.reject(
        new TypeError('fetch failed', {
          cause: Object.assign(new Error('read ECONNRESET'), {
            code: 'ECONNRESET',
          }),
        })
      ),
    () => Promise.resolve(new Response('ok')),
  ])

  const fetcher = await buildDispatchedFetch({
    connections: 1,
    loadUndici: () => Promise.resolve(undici),
  })

  await expect(fetcher('https://example.com/')).rejects.toThrow('fetch failed')
  await fetcher('https://example.com/')
  expect(agents).toHaveLength(1)
  expect(agents[0].close).not.toHaveBeenCalled()
})
