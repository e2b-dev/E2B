import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

const env = config()

// Runs the Desktop suite inside Cloudflare's workerd via vitest-pool-workers,
// against src — the same coverage as test:bun / test:deno get from the Node
// suite, but exercising the Workers runtime's fetch/streams implementations.
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
    exclude: ['tests/runtimes/**'],
    globals: false,
    testTimeout: 60_000,
    bail: 0,
    // workerd reports a rejection as unhandled unless a handler is attached
    // within the same microtask drain, and vitest never processes the
    // rejectionhandled retraction, so the aborts the SDK itself provokes when
    // a test's sandbox is killed mid-stream false-positive the run. Drop only
    // those shapes; uncaught exceptions and any unknown rejection still fail.
    onUnhandledError(error) {
      const message = String(error.message ?? '')
      const expectedRejection =
        error.type === 'Unhandled Rejection' &&
        (error.name === 'AbortError' ||
          error.name === 'ConnectError' ||
          message.startsWith('ConnectError:') ||
          // workerd's teardown error for in-flight streams.
          message === 'Network connection lost.')
      if (expectedRejection) return false
    },
  },
})
