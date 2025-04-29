import { defineConfig } from 'tsup'

export default defineConfig({
  minify: false,
  target: ['es2017'],
  sourcemap: true,
  dts: true,
  format: ['esm', 'cjs'],
  clean: true,
  entry: {
    index: './src/index.ts',
  },
  esbuildOptions: (options) => {
    options.legalComments = 'none'
    return options
  },
})
