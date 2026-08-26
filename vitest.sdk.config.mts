import type { ViteUserConfig } from 'vitest/config'

export function createSdkVitestConfig(
  env: Record<string, string>
): ViteUserConfig {
  return {
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/runtimes/**'],
      globals: false,
      testTimeout: 30_000,
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
