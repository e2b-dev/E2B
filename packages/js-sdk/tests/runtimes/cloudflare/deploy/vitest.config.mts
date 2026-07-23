import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config()

// Written by deploy.mjs (`pnpm deploy:cf`), which must run first. Skip
// locally when nothing is deployed, but fail loudly in CI where the deploy
// step is expected to have run.
const here = path.dirname(fileURLToPath(import.meta.url))
const hasDeployedUrl = existsSync(path.join(here, '.deployed-url'))

if (!hasDeployedUrl) {
  const message =
    'no .deployed-url found — run `pnpm deploy:cf` before the Cloudflare Workers deploy tests'
  if (process.env.CI) {
    throw new Error(message)
  }
  console.warn(`Skipping Cloudflare Workers deploy tests: ${message}`)
}

export default defineConfig({
  test: {
    name: 'cloudflare-deployed',
    include: hasDeployedUrl
      ? ['tests/runtimes/cloudflare/deploy/*.test.ts']
      : [],
    passWithNoTests: !hasDeployedUrl,
    environment: 'node',
    testTimeout: 60_000,
    globalSetup: ['tests/runtimes/cloudflare/deploy/teardown.mts'],
  },
})
