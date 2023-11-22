import { Sandbox } from '@e2b/sdk'

// Timeout 3s for the sandbox to open
const sandbox = await Sandbox.create({
  template: 'base',
  timeout: 3000, // $HighlightLine
})

await sandbox.close()
