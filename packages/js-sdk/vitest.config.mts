import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

const env = config()
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: [
            'tests/runtimes/**',
            'tests/template/**',
            'tests/connectionConfig.test.ts',
          ],
          // Isolation is required: several suites patch global fetch via msw
          // and rely on module mocks (vi.doMock / vi.resetModules). Under
          // vitest 4 a shared (non-isolated) context leaks this state across
          // files — e.g. aborted-request rejections and the cached undici
          // apiFetch singleton — causing cross-file failures.
          isolate: true,
          globals: false,
          testTimeout: 30_000,
          environment: 'node',
          bail: 0,
          setupFiles: ['tests/globalFetchFallback.setup.ts'],
          server: {},
          deps: {
            interopDefault: true,
          },
          env: {
            ...(process.env as Record<string, string>),
            ...env.parsed,
          },
        },
      },
      {
        test: {
          name: 'template',
          include: ['tests/template/**/*.test.ts'],
          globals: false,
          testTimeout: 180_000,
          environment: 'node',
          setupFiles: ['tests/globalFetchFallback.setup.ts'],
        },
      },
      {
        test: {
          name: 'connectionConfig',
          include: ['tests/connectionConfig.test.ts'],
          globals: false,
          isolate: true,
          testTimeout: 10_000,
          environment: 'node',
        },
      },
    ],
  },
})
