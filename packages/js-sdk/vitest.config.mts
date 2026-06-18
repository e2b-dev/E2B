import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
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
            'tests/integration/**',
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
          include: ['tests/runtimes/edge/**/*.{test,spec}.ts'],
          name: 'edge',
          environment: 'edge-runtime',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globals: false,
          testTimeout: 60_000,
          environment: 'node',
        },
      },
      {
        test: {
          name: 'template',
          include: ['tests/template/**/*.test.ts'],
          globals: false,
          testTimeout: 180_000,
          environment: 'node',
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
          // Expose `global.gc` so the streamed-read GC safety-net test can
          // force collection and observe the FinalizationRegistry callback.
          pool: 'forks',
          execArgv: ['--expose-gc'],
        },
      },
    ],
  },
})
