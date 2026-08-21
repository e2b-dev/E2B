import { expect, test, vi } from 'vitest'

import {
  buildDispatchedFetch,
  createRuntimeFetch,
  getUndiciPackageCandidates,
  loadUndici,
  type UndiciModule,
} from '../src/undici'
import { runtime } from '../src/utils'
import {
  foreignReadableStream,
  foreignRequestClasses,
} from './foreignPlatformObjects'

test.each([
  ['20.20.2', []],
  ['22.18.0', []],
  ['22.19.0', ['undici']],
  ['24.0.0', ['undici']],
])('selects the packages supported by Node %s', (version, expected) => {
  expect(getUndiciPackageCandidates(version as string)).toEqual(expected)
})

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
