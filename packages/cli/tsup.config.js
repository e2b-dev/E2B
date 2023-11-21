import { defineConfig } from 'tsup'

import * as packageJSON from './package.json'

const excludedPackages = ['update-notifier', 'inquirer']

export default defineConfig({
  entry: ['src/index.ts'],
  shims: true, // Needed for "open" package, as it uses import.meta.url and we are building for cjs
  target: 'node18',
  platform: 'node',
  format: 'cjs',
  clean: true,
  noExternal: Object.keys(packageJSON.dependencies).filter(
    f => !excludedPackages.includes(f)
  ),
  esbuildOptions: (options) => {
    options.legalComments = 'none'
    return options
  },
})
