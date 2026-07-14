import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: './src/index.ts' },
  target: 'es2017',
  format: ['esm', 'cjs'],
  fixedExtension: false,
  sourcemap: true,
  dts: true,
  clean: true,
})
