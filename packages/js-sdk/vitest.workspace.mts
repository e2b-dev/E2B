import { defineWorkspace } from 'vitest/config'
import { config } from 'dotenv'

const env = config()
export default defineWorkspace([
  {
    test: {
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/runtimes/**', 'tests/integration/**'],
      isolate: false, // for projects that don't rely on side effects, disabling isolation will improve the speed of the tests
      globals: false,
      testTimeout: 30_000,
      environment: 'node',
      bail: 1,
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
      include: ['tests/runtimes/browser/**/*.{test,spec}.tsx'],
      browser: {
        enabled: true,
        headless: true,
        instances: [{browser: 'chromium'}],
        provider: 'playwright',
        // https://playwright.dev
      },
      provide: {
        E2B_API_KEY: process.env.E2B_API_KEY || env.parsed.E2B_API_KEY,
      },
    },
  },
  {
    test: {
      include: ['tests/runtimes/edge/**/*.{test,spec}.ts'],
      name: 'node',
      environment: 'edge-runtime',
    },
  },
  {
    test: {
      include: ['tests/integration/**/*.test.ts'],
      globals: false,
      testTimeout: 60_000,
      environment: 'node',
    },
  },
])

