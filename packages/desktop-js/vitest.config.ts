import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

const env = config()

export default defineConfig({
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
    testTimeout: 30000,
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
})
