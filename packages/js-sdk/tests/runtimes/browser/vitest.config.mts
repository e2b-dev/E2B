import { playwright } from '@vitest/browser-playwright'
import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

// Real env vars win over `.env`, matching dotenv's own precedence.
const env = { ...config().parsed, ...process.env }

// Config the shared suites read from the environment; everything the SDK takes
// is `E2B_`-prefixed. Forwarded by name rather than as the whole environment,
// which would inline every host variable into JS served to the browser.
const testEnv = Object.fromEntries(
  Object.entries(env).filter(([name]) => name.startsWith('E2B_'))
) as Record<string, string>

// Runs the unit + connectionConfig projects (same coverage as test:bun /
// test:deno / test:cf) inside a real Chromium via Playwright, against src.
// Nothing is skipped for being a browser: the suites that can't run here are
// Node-only rather than browser-hostile, and they're excluded below. Tests that
// read a response from a server inside the sandbox start a CORS-enabled one
// (`corsHttpServerCmd` in tests/setup.ts), the way a browser app's own server
// would be configured.
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
      // Any new suite that imports `msw/node` belongs here — `grep -rl msw/node
      // tests/` lists the full set (tests/template/** is already excluded).
      'tests/client.test.ts',
      'tests/sandbox/abortSignal.test.ts',
      'tests/sandbox/egressProxy.test.ts',
      'tests/sandbox/iam.test.ts',
      'tests/sandbox/lifecycleRequest.test.ts',
      'tests/sandbox/networkTransform.test.ts',
      'tests/secret/secret.test.ts',
      'tests/volume/file.test.ts',
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
      // These tests drive the SDK and never render anything, so a failure
      // screenshot is a picture of a blank page. Off by default it would write
      // one PNG per failed test into .vitest-attachments/.
      screenshotFailures: false,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
