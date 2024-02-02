import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  template: 'base',
})

const npmInit = await sandbox.process.start({
  cmd: 'npm init -y',
})
await npmInit.kill() // $HighlightLine
// There will be no output because we immediately kill the `npm_init` process
console.log(npmInit.output.stdout)

await sandbox.close()
