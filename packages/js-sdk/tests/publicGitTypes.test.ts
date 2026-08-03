import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

// `reset()`, `restore()` and `status()` are public methods of Git, so the
// types naming their arguments and results have to be re-exported from the
// package entry point — otherwise a caller cannot name them and cannot write
// a typed wrapper. A missing re-export is invisible to `tsc --noEmit`, since
// tsconfig only includes `src`, so this checks the generated declarations
// instead, the same way the bundle test checks dist/index.mjs.

const typesPath = fileURLToPath(new URL('../dist/index.d.ts', import.meta.url))

// CI always builds before testing (see .github/workflows/js_sdk_tests.yml),
// so a missing bundle there is a real failure; locally it just means the
// build hasn't been run.
const typesExist = existsSync(typesPath)
if (!typesExist && process.env.CI) {
  throw new Error(
    `dist/index.d.ts not found at ${typesPath} — run \`pnpm build\` before testing`
  )
}

test.skipIf(!typesExist)(
  'git argument and status types are exported from the package entry point',
  () => {
    const declarations = readFileSync(typesPath, 'utf8')

    for (const name of [
      'GitResetMode',
      'GitResetOpts',
      'GitRestoreOpts',
      'GitStatusLabel',
    ]) {
      expect(declarations).toContain(`type ${name},`)
    }
  }
)
