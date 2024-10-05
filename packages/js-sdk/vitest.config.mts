import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

const env = config()

export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.ts',
    ],
    exclude: [
      'tests/runtimes/**',
    ],
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      },
    },
    maxWorkers: 5,
    globals: false,
    testTimeout: 20000,
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
})
