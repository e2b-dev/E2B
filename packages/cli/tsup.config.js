import { defineConfig } from 'tsup'

import * as packageJSON from './package.json'

const excludedPackages = ['inquirer']

export default defineConfig({
  entry: ['src/index.ts'],
  shims: true, // Needed for "open" package, as it uses import.meta.url and we are building for cjs
  target: 'node18',
  platform: 'node',
  format: 'cjs',
  sourcemap: true,
  clean: true,
  noExternal: Object.keys(packageJSON.dependencies).filter(
    (f) => !excludedPackages.includes(f)
  ),
  esbuildOptions: (options) => {
    options.legalComments = 'none'
    return options
  },
  // Copy template files to dist
  onSuccess: 'cp -r src/templates dist/',
})
