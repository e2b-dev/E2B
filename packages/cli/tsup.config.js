import { defineConfig } from 'tsup'

import * as packageJSON from './package.json'

const excludedPackages = ['inquirer', 'update-notifier']

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node16',
  platform: 'node',
  format: 'cjs',
  noExternal: Object.keys(packageJSON.dependencies).filter(
    f => !excludedPackages.includes(f),
  ),
})
