import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

config()

// Written by wrangler during `pnpm deploy:cf`, which must run first. Skip
// locally when nothing is deployed, but fail loudly in CI where the deploy
// step is expected to have run.
const here = path.dirname(fileURLToPath(import.meta.url))
const hasDeployOutput = existsSync(path.join(here, '.deploy-output.json'))

if (!hasDeployOutput) {
  const message =
    'no .deploy-output.json found — run `pnpm deploy:cf` before the Cloudflare Workers deploy tests'
  if (process.env.CI) {
    throw new Error(message)
  }
  console.warn(`Skipping Cloudflare Workers deploy tests: ${message}`)
}

export default defineConfig({
  test: {
    name: 'cloudflare-deployed',
    include: hasDeployOutput
      ? ['tests/runtimes/cloudflare/deploy/*.test.ts']
      : [],
    passWithNoTests: !hasDeployOutput,
    environment: 'node',
    testTimeout: 60_000,
  },
})
