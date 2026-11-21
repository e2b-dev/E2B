import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: './src/index.ts' },
  // Matches the `engines` floor. Not es2017 like js-sdk: rolldown lowers syntax
  // but not library methods, so an es2017 claim would be a lie the moment the
  // source touches anything newer (`Object.fromEntries` is ES2019).
  target: 'es2022',
  format: ['esm', 'cjs'],
  fixedExtension: false,
  sourcemap: true,
  dts: true,
  clean: true,
})
