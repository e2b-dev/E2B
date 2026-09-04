import { defineConfig } from 'vitest/config'

import {
  createCloudflareVitestConfig,
  isConnectRpcRejection,
} from '../../../../../vitest.cloudflare.config.mts'

export default defineConfig(
  createCloudflareVitestConfig({
    exclude: [
      // Serves the mocked API from a local node:http server, which workerd
      // cannot listen on; the Node unit project keeps running it.
      'tests/client.test.ts',
    ],
    testTimeout: 90_000,
    maxWorkers: 1,
    isExpectedRejection: isConnectRpcRejection,
  })
)
