import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

const env = config()

// The suite smoke-tests the built ESM bundle (what Workers users consume),
// so dist must exist. Skip locally to keep plain `vitest` runs green, but
// fail loudly in CI where the build step is expected to have run.
const distEntry = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../dist/index.mjs'
)
const hasDist = existsSync(distEntry)

if (!hasDist) {
  const message =
    'dist/index.mjs not found — run `pnpm build` in packages/js-sdk before running the Cloudflare Workers tests'
  if (process.env.CI) {
    throw new Error(message)
  }
  console.warn(`Skipping Cloudflare Workers tests: ${message}`)
}

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2026-03-01',
        compatibilityFlags: ['nodejs_compat'],
        bindings: {
          E2B_API_KEY: process.env.E2B_API_KEY ?? env.parsed?.E2B_API_KEY ?? '',
          E2B_DOMAIN: process.env.E2B_DOMAIN ?? env.parsed?.E2B_DOMAIN ?? '',
        },
      },
    }),
  ],
  test: {
    name: 'cloudflare',
    include: hasDist ? ['tests/runtimes/cloudflare/**/*.test.ts'] : [],
    passWithNoTests: !hasDist,
    testTimeout: 30_000,
  },
})
