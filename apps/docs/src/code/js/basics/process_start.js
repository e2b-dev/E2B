import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({id: 'base'})

const npmInit = await sandbox.process.start({
  cmd: 'npm init -y', // $HighlightLine
})
await npmInit.wait()

console.log(npmInit.output.stdout)

await sandbox.close()
