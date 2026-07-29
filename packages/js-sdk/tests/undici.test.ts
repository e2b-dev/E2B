import { expect, test, vi } from 'vitest'

import {
  createRuntimeFetch,
  getUndiciPackageCandidates,
  loadUndici,
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
