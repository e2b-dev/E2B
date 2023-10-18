import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    threads: false,
    globals: false,
    testTimeout: 20000,
    environment: 'node',
    server: {},
    deps: {
      interopDefault: true,
    },
  },
})
