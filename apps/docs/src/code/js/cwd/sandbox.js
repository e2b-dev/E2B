import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({
  id: 'base',
  cwd: '/code', // $HighlightLine
})

// You can also change the cwd of an existing sandbox
sandbox.cwd = '/home' // $HighlightLine

await sandbox.close()
