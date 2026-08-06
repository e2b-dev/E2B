import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

// Bundlers turn bare `require` references in ESM source into a
// `createRequire(import.meta.url)` helper that is evaluated eagerly when the
// module loads. In edge runtimes (e.g. Cloudflare Workers) `import.meta.url`
// is undefined in bundled code, so importing the SDK crashes before any API
// call is made. See https://github.com/e2b-dev/E2B/issues/1579
//
// Instead of `require`, use a static default import (`import fs from
// 'node:fs'`) or `dynamicImport` from src/utils.ts — neither makes the
// bundler emit the shim.

const bundlePath = fileURLToPath(
  new URL('../../dist/index.mjs', import.meta.url)
)

// CI always builds before testing (see .github/workflows/js_sdk_tests.yml),
// so a missing bundle there is a real failure; locally it just means the
// build hasn't been run.
const bundleExists = existsSync(bundlePath)
if (!bundleExists && process.env.CI) {
  throw new Error(
    `dist/index.mjs not found at ${bundlePath} — run \`pnpm build\` before testing`
  )
}

test.skipIf(!bundleExists)(
  'ESM bundle contains no require shim (edge-runtime safe)',
  () => {
    const bundle = readFileSync(bundlePath, 'utf8')

    expect(bundle).not.toMatch(/from\s*['"]node:module['"]/)
    expect(bundle).not.toMatch(/\bcreateRequire\s*\(/)
    expect(bundle).not.toMatch(/\b__require\b/)
  }
)
