import { defineConfig } from 'tsup'

import * as packageJSON from './package.json'

const excludedPackages = ['inquirer', 'update-notifier']

export default defineConfig({
  entry: ['src/index.ts'],
  shims: true, // Needed for "open" package, as it uses import.meta.url and we are building for cjs
  target: 'node16',
  platform: 'node',
  format: 'cjs',
  noExternal: Object.keys(packageJSON.dependencies).filter(
    f => !excludedPackages.includes(f),
  ),
})
