import { defineConfig } from 'vitest/config'

import {
  createCloudflareVitestConfig,
  isConnectRpcRejection,
} from '../../../../../vitest.cloudflare.config.mts'

export default defineConfig(
  createCloudflareVitestConfig({
    testTimeout: 60_000,
    isExpectedRejection: isConnectRpcRejection,
  })
)
