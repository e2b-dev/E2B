import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({ template: 'base' })

// This example will print back the string we send to the process using `sendStdin()`

const proc = await sandbox.process.start({
  cmd: 'while IFS= read -r line; do echo "$line"; sleep 1; done',
  onStdout: (output) => console.log(output),
})
await proc.sendStdin('AI Playground\n') // $HighlightLine
await proc.kill()

await sandbox.close()
