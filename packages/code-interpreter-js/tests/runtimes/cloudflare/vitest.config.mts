import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

const env = config()

// Runs the same suite the node/bun/deno legs run, but inside Cloudflare's
// workerd via vitest-pool-workers, against src.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2026-03-01',
        // nodejs_compat is a hard requirement for the SDK on Workers. It also
        // mirrors the bindings below into process.env (default since compat
        // date 2025-04-01), which is how tests and the SDK read E2B_*.
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
    include: ['tests/**/*.test.ts'],
    globals: false,
    testTimeout: 30_000,
    bail: 0,
    // workerd reports a rejection as unhandled unless a handler is attached
    // within the same microtask drain, so the stream teardown of a sandbox the
    // test kills (or interrupts) mid-request is reported even though the test
    // awaits it. Drop only those two shapes; anything else still fails the run.
    onUnhandledError(error) {
      const message = String(error.message ?? '')
      const expectedRejection =
        error.type === 'Unhandled Rejection' &&
        (message === 'Network connection lost.' || error.name === 'AbortError')
      if (expectedRejection) return false
    },
  },
})
