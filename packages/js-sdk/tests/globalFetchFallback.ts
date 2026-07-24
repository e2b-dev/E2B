type UndiciModule = typeof import('../src/undici')

/**
 * msw mocks the network by patching `globalThis.fetch`, which the undici
 * dispatcher the SDK uses on Node bypasses entirely — mocked requests would
 * escape to the real API. Suites that mock the API with msw wrap the undici
 * module with this so requests run through the SDK's real undici-unavailable
 * fallback, which late-binds `globalThis.fetch`:
 *
 * ```ts
 * vi.mock('../../src/undici', async (importOriginal) =>
 *   (await import('../globalFetchFallback')).withGlobalFetchFallback(
 *     await importOriginal()
 *   )
 * )
 * ```
 */
export function withGlobalFetchFallback(module: unknown): UndiciModule {
  const original = module as UndiciModule
  return {
    ...original,
    buildDispatchedFetch: (options) =>
      original.buildDispatchedFetch({
        ...options,
        loadUndici: async () => undefined,
      }),
  }
}
