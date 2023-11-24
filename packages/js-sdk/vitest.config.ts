import { defineConfig } from 'vitest/config'

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
  },
})
