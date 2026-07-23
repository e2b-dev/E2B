import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

const env = config()

// Runs the unit + connectionConfig projects (same coverage as test:bun /
// test:deno) inside Cloudflare's workerd via vitest-pool-workers, against src.
// The real-deploy suite (tests/runtimes/cloudflare-deploy) keeps covering the
// built bundle on actual Cloudflare infrastructure.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2026-03-01',
        // nodejs_compat is a hard requirement for the SDK on Workers;
        // nodejs_compat_populate_process_env mirrors the bindings into
        // process.env so tests and the SDK read E2B_* like on Node.
        compatibilityFlags: [
          'nodejs_compat',
          'nodejs_compat_populate_process_env',
        ],
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
    exclude: ['tests/runtimes/**', 'tests/template/**'],
    globals: false,
    testTimeout: 30_000,
    bail: 0,
    // workerd reports a rejection as unhandled unless a handler is attached
    // within the same microtask drain, so the common `const p = op(); …;
    // await expect(p).rejects` pattern false-positives (verified with a plain
    // `Promise.reject` handled one macrotask later — Node un-reports it,
    // workerd does not). Real failures still fail the run as test errors.
    dangerouslyIgnoreUnhandledErrors: true,
  },
})
