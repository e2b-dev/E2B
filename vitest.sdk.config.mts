import type { ViteUserConfig } from 'vitest/config'

export function createSdkVitestConfig(
  env: Record<string, string>
): ViteUserConfig {
  return {
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/runtimes/**'],
      globals: false,
      // Live sandbox creation and language startup share this budget with the
      // assertion body; slower kernels regularly need more than 30 seconds.
      testTimeout: 60_000,
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
