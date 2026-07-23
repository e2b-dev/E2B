import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

const env = config()

// Error names thrown by src/errors.ts (plus CommandExitError) — the shapes
// this suite's rejection tests expect. Kept as a literal list so an unknown
// error class still fails the run instead of being silently ignored.
const SDK_ERROR_NAMES = new Set([
  'SandboxError',
  'TimeoutError',
  'InvalidArgumentError',
  'NotEnoughSpaceError',
  'NotFoundError',
  'FileNotFoundError',
  'SandboxNotFoundError',
  'AuthenticationError',
  'GitAuthError',
  'GitUpstreamError',
  'TemplateError',
  'RateLimitError',
  'BuildError',
  'FileUploadError',
  'VolumeError',
  'CommandExitError',
])

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
    exclude: [
      'tests/runtimes/**',
      'tests/template/**',
      // Inspects the host-built dist/index.mjs via node:fs, which workerd's
      // virtual filesystem can never see (and throws in CI when the file is
      // "missing"); the Node unit project keeps running it.
      'tests/bundle/**',
    ],
    globals: false,
    testTimeout: 30_000,
    bail: 0,
    // workerd reports a rejection as unhandled unless a handler is attached
    // within the same microtask drain, and vitest never processes the
    // rejectionhandled retraction, so rejections the tests DO handle (the
    // `await expect(p).rejects` pattern, including inline ones — workerd also
    // flags intermediate promises of the async-function chain) false-positive
    // ~60 times per run. Instead of dangerouslyIgnoreUnhandledErrors, drop
    // only the rejection shapes these tests deliberately provoke; uncaught
    // exceptions and any unknown rejection shape still fail the run.
    onUnhandledError(error) {
      const message = String(error.message ?? '')
      const expectedRejection =
        error.type === 'Unhandled Rejection' &&
        // SDK public errors — what `expect(p).rejects` asserts on.
        (SDK_ERROR_NAMES.has(error.name) ||
          // The transport errors the SDK wraps: connect-rpc failures and
          // aborted requests surface on intermediate promises too.
          error.name === 'ConnectError' ||
          message.startsWith('ConnectError:') ||
          error.name === 'AbortError' ||
          // workerd's teardown error for in-flight streams when a test kills
          // the sandbox mid-request.
          message === 'Network connection lost.' ||
          // Stub rejection from tests/sandbox/git/validation.test.ts.
          message === 'commands.run should not be called')
      if (expectedRejection) return false
    },
  },
})
