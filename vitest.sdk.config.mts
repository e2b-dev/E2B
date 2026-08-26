export function createSdkVitestConfig(env: Record<string, string>) {
  return {
    test: {
      poolOptions: {
        threads: {
          minThreads: 1,
          maxThreads: 4,
        },
      },
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/runtimes/**'],
      globals: false,
      testTimeout: 30_000,
      environment: 'node' as const,
      bail: 0,
      server: {},
      deps: {
        interopDefault: true,
      },
      env,
    },
  }
}
