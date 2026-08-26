export const sdkTsdownConfig = {
  entry: { index: './src/index.ts' },
  target: 'es2017',
  format: ['esm', 'cjs'] as ('esm' | 'cjs')[],
  fixedExtension: false,
  sourcemap: true,
  dts: true,
  clean: true,
}
