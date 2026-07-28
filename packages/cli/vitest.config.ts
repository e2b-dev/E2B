import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    testTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'testground'],
    globalSetup: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
      // Mirror the `e2b` path in tsconfig.json, which is what tsc and the bundle
      // already resolve to. Without it `e2b` resolves to the workspace package's
      // `main`, which only exists once the SDK has been built.
      e2b: path.resolve(__dirname, '../js-sdk/src'),
    },
  },
})
