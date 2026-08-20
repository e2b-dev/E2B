import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { config } from 'dotenv'

import { e2eFiles } from './tests/e2eFiles.mjs'

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
            ...e2eFiles,
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
          // Provisions a real sandbox from a browser bundle, so it belongs to
          // the e2e tier: run with `pnpm test:browser`.
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
          exclude: e2eFiles,
          globals: false,
          testTimeout: 180_000,
          environment: 'node',
          setupFiles: ['tests/globalFetchFallback.setup.ts'],
        },
      },
      {
        test: {
          // Opt-in tier: run with `pnpm test:e2e` (needs E2B_E2E=1 and
          // credentials). Excluded from the default `pnpm test` run.
          name: 'e2e',
          include: e2eFiles,
          isolate: true,
          globals: false,
          testTimeout: 180_000,
          environment: 'node',
          setupFiles: ['tests/globalFetchFallback.setup.ts'],
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
