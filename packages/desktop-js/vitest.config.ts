import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

import { createSdkVitestConfig } from '../../vitest.sdk.config.mts'

const env = config()

export default defineConfig(
  createSdkVitestConfig({
    ...(process.env as Record<string, string>),
    ...env.parsed,
  })
)
