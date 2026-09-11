import { createReadStream } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { playwright } from '@vitest/browser-playwright'
import { config } from 'dotenv'
import { defineConfig, type Plugin } from 'vitest/config'

// Real env vars win over `.env`, matching dotenv's own precedence.
const env = { ...config().parsed, ...process.env }

// Config the shared suites read from the environment; everything the SDK takes
// is `E2B_`-prefixed. Forwarded by name rather than as the whole environment,
// which would inline every host variable into JS served to the browser.
const testEnv = Object.fromEntries(
  Object.entries(env).filter(([name]) => name.startsWith('E2B_'))
) as Record<string, string>

const testsDir = fileURLToPath(new URL('../..', import.meta.url))
const nodeMockApi = join(testsDir, 'mockApi.ts')
const browserMockApi = fileURLToPath(new URL('./mockApi.ts', import.meta.url))
const workerScript = join(
  dirname(createRequire(import.meta.url).resolve('msw/package.json')),
  'lib/mockServiceWorker.js'
)

// The suites that mock the API import `setupMockApi` from tests/mockApi.ts,
// which wraps `msw/node` — an entry that pulls in node:http and can't be
// served to a browser. Redirect that one module to the Service Worker-backed
// implementation, and serve msw's worker script at the URL `worker.start()`
// registers by default, straight from the installed package rather than a
// checked-in copy that would drift from the library version.
const browserMockApiPlugin: Plugin = {
  name: 'e2b:browser-mock-api',
  // Before Vite's own resolver, which would otherwise settle the import first.
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer || !/\bmockApi(\.ts)?$/.test(source)) return
    const resolved = await this.resolve(source, importer, {
      ...options,
      skipSelf: true,
    })
    return resolved?.id === nodeMockApi ? browserMockApi : undefined
  },
  configureServer(server) {
    server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
      res.setHeader('Content-Type', 'text/javascript')
      createReadStream(workerScript).pipe(res)
    })
  },
}

// Runs the unit + connectionConfig projects (same coverage as test:bun /
// test:deno / test:cf) inside a real Chromium via Playwright, against src.
// Nothing is skipped for being a browser: the suites that can't run here are
// Node-only rather than browser-hostile, and they're excluded below. Tests that
// read a response from a server inside the sandbox start a CORS-enabled one
// (`corsHttpServerCmd` in tests/setup.ts), the way a browser app's own server
// would be configured.
export default defineConfig({
  plugins: [browserMockApiPlugin],
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
    ],
    globals: false,
    testTimeout: 30_000,
    // Same one-live-worker cap CI sets for every other runtime leg.
    maxWorkers: process.env.E2B_TEST_MAX_WORKERS
      ? Number(process.env.E2B_TEST_MAX_WORKERS)
      : undefined,
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
