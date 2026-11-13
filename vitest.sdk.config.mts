import type { ViteUserConfig } from 'vitest/config'

export function createSdkVitestConfig(
  env: Record<string, string>,
  options: { testTimeout?: number } = {}
): ViteUserConfig {
  const maxWorkers = env.E2B_TEST_MAX_WORKERS
    ? Number(env.E2B_TEST_MAX_WORKERS)
    : undefined

  return {
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/runtimes/**'],
      globals: false,
      // Live sandbox creation and language startup share this budget with the
      // assertion body; slower kernels regularly need more than 30 seconds.
      testTimeout: options.testTimeout ?? 60_000,
      maxWorkers,
      environment: 'node',
      bail: 0,
      server: {},
      deps: {
        interopDefault: true,
      },
      env,
    },
  }
}
