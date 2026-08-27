import { defineConfig } from 'vitest/config'

import { createCloudflareVitestConfig } from '../../../../../vitest.cloudflare.config.mts'

export default defineConfig(
  createCloudflareVitestConfig({
    exclude: [
      // Serves the mocked API from a local node:http server, which workerd
      // cannot listen on; the Node unit project keeps running it.
      'tests/client.test.ts',
    ],
  })
)
