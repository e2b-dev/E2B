import { defineConfig } from 'vitest/config'

import { createCloudflareVitestConfig } from '../../../../../vitest.cloudflare.config.mts'

export default defineConfig(
  createCloudflareVitestConfig({ testTimeout: 90_000, maxWorkers: 1 })
)
