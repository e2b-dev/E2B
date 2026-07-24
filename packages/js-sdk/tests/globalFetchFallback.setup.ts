import { vi } from 'vitest'

// msw mocks the network by patching `globalThis.fetch`, which the undici
// dispatcher the SDK uses on Node bypasses entirely — mocked requests would
// escape to the real API. Registered via `setupFiles` for every Node project,
// this reroutes the SDK through its real undici-unavailable fallback, which
// late-binds `globalThis.fetch`, so msw suites need no per-file mock. Tests
// that inject their own `loadUndici` (the api/envd transport suites) keep it,
// so the dispatcher wiring itself stays covered.
vi.mock('../src/undici', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/undici')>()
  return {
    ...original,
    buildDispatchedFetch: (
      options: Parameters<typeof original.buildDispatchedFetch>[0]
    ) =>
      original.buildDispatchedFetch({
        ...options,
        loadUndici: options.loadUndici ?? (async () => undefined),
      }),
  }
})
