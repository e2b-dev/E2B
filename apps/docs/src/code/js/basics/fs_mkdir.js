import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({ template: 'base' })

// Create a new directory '/dir'
await sandbox.filesystem.makeDir('/dir') // $HighlightLine

await sandbox.close()
