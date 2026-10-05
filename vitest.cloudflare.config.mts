import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { config } from 'dotenv'
import type { ViteUserConfig } from 'vitest/config'

type UnhandledError = Parameters<
  NonNullable<NonNullable<ViteUserConfig['test']>['onUnhandledError']>
>[0]

/**
 * The connect-rpc failures the SDK wraps — they surface on the intermediate
 * promises of the async-function chain too, so suites that assert on them with
 * `expect(p).rejects` need them dropped.
 */
export function isConnectRpcRejection(
  error: UnhandledError,
  message: string
): boolean {
  return error.name === 'ConnectError' || message.startsWith('ConnectError:')
}

export interface CloudflareVitestConfigOptions {
  /** Globs excluded on top of `tests/runtimes/**`. */
  exclude?: string[]
  testTimeout?: number
  maxWorkers?: number
  /** Additional rejection shapes to drop, on top of the shared ones. */
  isExpectedRejection?: (error: UnhandledError, message: string) => boolean
}

/**
 * Runs a package's Node suite inside Cloudflare's workerd via
 * vitest-pool-workers, against src — the same coverage as the bun and deno
 * legs, but exercising the Workers runtime's fetch/streams implementations.
 */
export function createCloudflareVitestConfig({
  exclude = [],
  testTimeout = 30_000,
  maxWorkers,
  isExpectedRejection,
}: CloudflareVitestConfigOptions = {}): ViteUserConfig {
  const env = config()

  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: '2026-03-01',
          // nodejs_compat is a hard requirement for the SDK on Workers. It also
          // mirrors the bindings below into process.env (default since compat
          // date 2025-04-01), which is how tests and the SDK read E2B_*.
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            E2B_API_KEY:
              process.env.E2B_API_KEY ?? env.parsed?.E2B_API_KEY ?? '',
            E2B_DOMAIN: process.env.E2B_DOMAIN ?? env.parsed?.E2B_DOMAIN ?? '',
          },
        },
      }),
    ],
    test: {
      name: 'cloudflare',
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/runtimes/**', ...exclude],
      globals: false,
      testTimeout,
      maxWorkers,
      bail: 0,
      // workerd reports a rejection as unhandled unless a handler is attached
      // within the same microtask drain, and vitest never processes the
      // rejectionhandled retraction, so rejections the tests DO handle (the
      // `await expect(p).rejects` pattern, including the intermediate promises
      // of the async-function chain) false-positive the run. Instead of
      // dangerouslyIgnoreUnhandledErrors, drop only the rejection shapes these
      // suites deliberately provoke; uncaught exceptions and any unknown
      // rejection shape still fail the run.
      onUnhandledError(error) {
        if (error.type !== 'Unhandled Rejection') return
        const message = String(error.message ?? '')
        const expectedRejection =
          // Aborted requests surface on intermediate promises too.
          error.name === 'AbortError' ||
          // workerd's teardown error for in-flight streams when a test kills
          // the sandbox mid-request.
          message === 'Network connection lost.' ||
          isExpectedRejection?.(error, message) === true
        if (expectedRejection) return false
      },
    },
  }
}
