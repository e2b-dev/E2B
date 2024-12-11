import { defineWorkspace } from 'vitest/config'
import { config } from 'dotenv'

const env = config()

export default defineWorkspace([
  {
    test: {
      include: [
        'tests/**/*.test.ts',
      ],
      exclude: [
        'tests/runtimes/**',
      ],
      globals: false,
      testTimeout: 30000,
      environment: 'node',
      bail: 1,
      server: {},
      deps: {
        interopDefault: true,
      },
      env: {
        ...process.env as Record<string, string>,
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
        name: 'chromium',
        provider: 'playwright',
        // https://playwright.dev
        providerOptions: {},
      },
      env: {
      ...process.env as Record<string, string>,
      ...env.parsed,
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
])
