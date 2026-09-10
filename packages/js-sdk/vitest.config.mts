import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { config } from 'dotenv'

const env = config()
const maxWorkers = process.env.E2B_TEST_MAX_WORKERS
  ? Number(process.env.E2B_TEST_MAX_WORKERS)
  : undefined
export default defineConfig({
  test: {
    maxWorkers,
    // The default reporter only shows console output (e.g. sandbox IDs) for
    // failed tests; the verbose reporter shows it for every test.
    reporters: process.env.GITHUB_ACTIONS
      ? ['verbose', 'github-actions']
      : ['default'],
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
          maxWorkers,
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
          name: 'browser',
          include: ['tests/runtimes/browser/**/*.{test,spec}.tsx'],
          browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: 'chromium' }],
            provider: playwright(),
            // https://playwright.dev
          },
          provide: {
            E2B_API_KEY: process.env.E2B_API_KEY || env.parsed?.E2B_API_KEY,
            E2B_DOMAIN: process.env.E2B_DOMAIN || env.parsed?.E2B_DOMAIN,
          },
        },
      },
      {
        test: {
          name: 'template',
          include: ['tests/template/**/*.test.ts'],
          globals: false,
          testTimeout: 180_000,
          maxWorkers,
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
