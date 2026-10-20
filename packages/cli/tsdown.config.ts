import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

const require = createRequire(import.meta.url)
const packageJSON = require('./package.json') as {
  dependencies: Record<string, string>
}

const excludedPackages = ['inquirer']

export default defineConfig({
  entry: ['src/index.ts'],
  shims: true, // Needed for "open" package, as it uses import.meta.url and we are building for cjs
  target: 'node22',
  platform: 'node',
  format: 'cjs',
  // Emit the bin as dist/index.js (matches the package.json "bin" entry)
  fixedExtension: false,
  // The CLI is an executable, it doesn't ship type declarations
  dts: false,
  sourcemap: true,
  clean: true,
  // Bundle from source rather than dist: during a release `changeset publish`
  // rebuilds workspace packages concurrently, and their `clean` wipes dist.
  alias: {
    '@e2b/dockerfile-utils': fileURLToPath(
      new URL('../dockerfile-utils-js/src/index.ts', import.meta.url)
    ),
  },
  deps: {
    // Bundle all runtime dependencies (except those that must stay external)
    alwaysBundle: Object.keys(packageJSON.dependencies).filter(
      (f) => !excludedPackages.includes(f)
    ),
  },
  // Copy template files to dist/templates
  copy: [{ from: 'src/templates', to: 'dist' }],
})
