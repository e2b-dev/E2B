import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({id: 'base'})

// Timeout 3s for the process to start
const npmInit = await sandbox.process.start({
  cmd: 'npm init -y',
  timeout: 3000, // $HighlightLine
})
await npmInit.wait()

await sandbox.close()
