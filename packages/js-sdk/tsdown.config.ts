import { defineConfig } from 'tsdown'

import { createSdkTsdownConfig } from '../../tsdown.sdk.config.mts'

export default defineConfig(
  createSdkTsdownConfig({
    // ESM-only package inlined into both output formats — our engines range
    // includes Node versions that cannot require() ESM from the CJS build.
    noExternal: ['error-stack-parser-es'],
  })
)
