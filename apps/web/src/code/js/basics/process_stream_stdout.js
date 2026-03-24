import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  template: 'base',
  onStdout: (output) => console.log('sandbox', output.line), // $HighlightLine
})

const proc = await sandbox.process.start({
  cmd: 'echo "Hello World!"',
})
await proc.wait()
// output: sandbox Hello World!

const procWithCustomHandler = await sandbox.process.start({
  cmd: 'echo "Hello World!"',
  onStdout: (data) => console.log('process', data.line), // $HighlightLine
})
await procWithCustomHandler.wait()
// output: process Hello World!

await sandbox.close()
