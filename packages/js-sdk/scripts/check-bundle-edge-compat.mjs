// Fails the build if the ESM bundle contains a module-scope `require` shim.
//
// Bundlers turn bare `require` references in ESM source into a
// `createRequire(import.meta.url)` helper that is evaluated eagerly when the
// module loads. In edge runtimes (e.g. Cloudflare Workers) `import.meta.url`
// is undefined in bundled code, so importing the SDK crashes before any API
// call is made. See https://github.com/e2b-dev/E2B/issues/1579
//
// Instead of `require`, load Node.js built-ins with `dynamicRequire` from
// src/utils.ts (backed by `process.getBuiltinModule`).
import { readFileSync } from 'node:fs'

const bundlePath = new URL('../dist/index.mjs', import.meta.url)
const bundle = readFileSync(bundlePath, 'utf8')

const forbidden = [
  /from\s*['"]node:module['"]/,
  /\bcreateRequire\s*\(/,
  /\b__require\b/,
]

const hit = forbidden.find((pattern) => pattern.test(bundle))
if (hit) {
  console.error(
    `dist/index.mjs matches ${hit} — the bundle contains a \`require\` shim ` +
      'that crashes edge runtimes such as Cloudflare Workers. Remove bare ' +
      '`require` references from src (use `dynamicRequire` from src/utils.ts).'
  )
  process.exit(1)
}

console.log('dist/index.mjs is free of require shims (edge-runtime safe)')
