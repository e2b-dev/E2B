import type { UserConfig } from 'tsdown'

const sdkTsdownConfig = {
  entry: { index: './src/index.ts' },
  target: 'es2017',
  format: ['esm', 'cjs'],
  fixedExtension: false,
  sourcemap: true,
  dts: true,
  clean: true,
} satisfies UserConfig

export function createSdkTsdownConfig(overrides: UserConfig = {}): UserConfig {
  return {
    ...sdkTsdownConfig,
    ...overrides,
  }
}
