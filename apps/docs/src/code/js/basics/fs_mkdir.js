import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({id: 'base'})

// `filesystem.make_dir()` will fail if any directory in the path doesn't exist
// Create a new directory '/dir'
await sandbox.filesystem.makeDir('/dir') // $HighlightLine

await sandbox.close()
