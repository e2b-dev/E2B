import { defineConfig } from 'tsup'

import packageJSON from './package.json'

export default defineConfig({
  entry: ['src/cli.ts'],
  target: 'node16',
  platform: 'node',
  format: 'cjs',
  noExternal: Object.keys(packageJSON.dependencies).filter(f => f !== 'inquirer'),
})
