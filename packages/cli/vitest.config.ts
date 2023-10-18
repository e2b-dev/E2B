import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    threads: false,
    globals: false,
    environment: 'node',
    server: {},
    deps: {
      interopDefault: true,
    },
  },
})
