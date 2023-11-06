import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({
  id: 'base',
  envVars: {FOO: 'Hello'}, // $HighlightLine
})

await sandbox.close()
