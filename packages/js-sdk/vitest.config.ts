import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

const env = config()

export default defineConfig({
  test: {
    threads: false,
    globals: false,
    testTimeout: 20000,
    environment: 'node',
    bail: 1,
    server: {},
    deps: {
      interopDefault: true,
    },
    env: env.parsed,
  },
})
