import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config()

// The suite deploys the built ESM bundle to real Cloudflare infrastructure
// (setup.mts), so dist must exist. Skip locally to keep plain runs green,
// but fail loudly in CI where the build step is expected to have run.
const here = path.dirname(fileURLToPath(import.meta.url))
const hasDist = existsSync(path.resolve(here, '../../../dist/index.mjs'))

if (!hasDist) {
  const message =
    'dist/index.mjs not found — run `pnpm build` in packages/js-sdk before running the Cloudflare Workers deploy tests'
  if (process.env.CI) {
    throw new Error(message)
  }
  console.warn(`Skipping Cloudflare Workers deploy tests: ${message}`)
}

export default defineConfig({
  test: {
    name: 'cloudflare-deploy',
    include: hasDist ? ['tests/runtimes/cloudflare-deploy/*.test.ts'] : [],
    passWithNoTests: !hasDist,
    globalSetup: hasDist ? ['tests/runtimes/cloudflare-deploy/setup.mts'] : [],
    environment: 'node',
    testTimeout: 60_000,
  },
})
