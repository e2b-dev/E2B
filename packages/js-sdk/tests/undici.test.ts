import { expect, test, vi } from 'vitest'

import {
  buildDispatchedFetch,
  createRuntimeFetch,
  getUndiciPackageCandidates,
  loadUndici,
  type UndiciModule,
} from '../src/undici'
import { runtime } from '../src/utils'

test.each([
  ['20.20.2', ['undici']],
  ['22.18.0', ['undici']],
  ['22.19.0', ['undici8', 'undici']],
  ['24.0.0', ['undici8', 'undici']],
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

// A Request minted by a different Request class than the one `instanceof`
// checks against. This happens in real processes: runtimes and tools replace
// `globalThis.Request` just like they replace `globalThis.fetch` (test
// environments, instrumentation, server shims such as @hono/node-server), and
// two copies of one shim can coexist — each with its own class. Sibling
// subclasses of the native Request reproduce exactly that: an instance of one
// is a fully functional Request but fails `instanceof` against the other.
test('destructures a Request minted by a foreign Request class instead of passing it to undici verbatim', async () => {
  const NativeRequest = globalThis.Request
  class MintingRequest extends NativeRequest {}
  class GlobalShimRequest extends NativeRequest {}

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
  })

  vi.stubGlobal('Request', GlobalShimRequest)
  try {
    // The premise: a real Request that the current global class disowns.
    expect(request instanceof globalThis.Request).toBe(false)

    const fetcher = await buildDispatchedFetch({
      connections: 1,
      inflightLimit: 0,
      loadUndici: async () => fakeUndici,
    })
    await fetcher(request as unknown as RequestInfo)
  } finally {
    vi.unstubAllGlobals()
  }

  // Undici's fetch cannot brand-check a foreign Request either — passed
  // through verbatim it would be coerced to a URL string and crash with
  // `Failed to parse URL from [object Request]`. It must arrive destructured.
  expect(seen).toHaveLength(1)
  expect(seen[0].input).toBe('https://api.example.test/sandboxes')
  expect(seen[0].init?.method).toBe('POST')
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
