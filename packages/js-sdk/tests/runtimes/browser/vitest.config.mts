import { playwright } from '@vitest/browser-playwright'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

// Real env vars win over `.env`, matching dotenv's own precedence.
const env = { ...config().parsed, ...process.env }

// Config the shared suites read from the environment. Everything the SDK takes
// is `E2B_`-prefixed; ENABLE_VOLUME_TESTS gates the volume suite. Forwarded by
// name rather than as the whole environment, which would inline every host
// variable into JS served to the browser.
const testEnv = Object.fromEntries(
  Object.entries(env).filter(
    ([name]) => name.startsWith('E2B_') || name === 'ENABLE_VOLUME_TESTS'
  )
) as Record<string, string>

// Runs the unit + connectionConfig projects (same coverage as test:bun /
// test:deno / test:cf) inside a real Chromium via Playwright, against src.
// Tests the browser physically can't run are skipped from the test files
// themselves — see the capability flags in tests/setup.ts — so they stay
// visible in the report instead of disappearing into the exclude list below.
export default defineConfig({
  test: {
    name: 'browser',
    include: [
      'tests/**/*.test.ts',
      // Browser-only suite; tests/runtimes/** is otherwise excluded below.
      'tests/runtimes/browser/**/*.test.ts',
    ],
    exclude: [
      // Other runtimes' suites, which run under their own configs. This
      // suite's own browser-only tests are re-included above; a new runtime
      // directory needs adding here.
      'tests/runtimes/cloudflare*/**',
      'tests/template/**',
      // Inspects the host-built dist/index.mjs via node:fs, which the browser
      // can never see; the Node unit project keeps running it.
      'tests/bundle/**',
      // Resolves the `undici`/`undici8` packages off `process.versions.node`.
      // The browser never takes that path — `createRuntimeFetch` late-binds
      // the global fetch outside Node — so there is nothing to cover here.
      'tests/undici.test.ts',
      // These mock the API with msw's `setupServer`, whose `msw/node` entry
      // pulls in node:http and can't be served to the browser. Porting them
      // means `setupWorker` plus a service worker served from a public dir.
      'tests/sandbox/abortSignal.test.ts',
      'tests/volume/volume.test.ts',
    ],
    globals: false,
    testTimeout: 30_000,
    // A real browser has no `process`; the setup file shims `process.env` onto
    // `import.meta.env`, where vitest puts `env` below, so the shared suites
    // can read their config the way they do on every other runtime.
    setupFiles: ['tests/runtimes/browser/processEnv.setup.ts'],
    env: testEnv,
    browser: {
      enabled: true,
      // Defaults to `isCI`, so set it explicitly for local runs too.
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
