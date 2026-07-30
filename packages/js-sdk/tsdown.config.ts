import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: './src/index.ts' },
  target: 'es2017',
  format: ['esm', 'cjs'],
  // ESM-only package inlined into both output formats — our engines range
  // includes Node versions that cannot require() ESM from the CJS build.
  noExternal: ['error-stack-parser-es'],
  fixedExtension: false,
  sourcemap: true,
  dts: true,
  clean: true,
})
