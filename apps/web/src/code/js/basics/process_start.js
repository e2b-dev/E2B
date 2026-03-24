import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({ template: 'base' })

const npmInit = await sandbox.process.start({
  cmd: 'npm init -y', // $HighlightLine
})
await npmInit.wait()

console.log(npmInit.output.stdout)

await sandbox.close()
