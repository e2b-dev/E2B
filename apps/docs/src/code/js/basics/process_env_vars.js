import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({
  id: 'base',
  envVars: {FOO: 'Hello'},
})

const proc = await sandbox.process.start({
  cmd: 'echo $FOO $BAR!',
  envVars: {BAR: 'World'}, // $HighlightLine
})
await proc.wait()
console.log(proc.output.stdout)
// output: Hello World!

await sandbox.close()
