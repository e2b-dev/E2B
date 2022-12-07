import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  target: 'node16',
  platform: 'node',
  format: 'cjs',
  noExternal: ['chalk', 'boxen', 'inquirer'],
})
