import { defineConfig, mergeConfig } from 'vitest/config'

import base from './vitest.config'

// Opt-in tier: `pnpm test:e2e`. The flag the tests gate on is set here rather
// than in the package script, which would need POSIX-only `VAR=value` syntax
// and break on Windows.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      env: {
        E2B_E2E: '1',
      },
    },
  })
)
