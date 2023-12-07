import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  shims: true, // Needed for "open" package, as it uses import.meta.url and we are building for cjs
  target: 'node18',
  platform: 'node',
  format: 'cjs',
  clean: true,
  esbuildOptions: (options) => {
    options.legalComments = 'none'
    return options
  },
})