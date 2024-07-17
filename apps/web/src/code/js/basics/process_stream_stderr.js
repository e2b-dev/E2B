import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  template: 'base',
})

// This command will fail and output to stderr because Golang isn't installed in the cloud playground
const golangVersion = await sandbox.process.start({
  cmd: 'go version',
  onStderr: (output) => console.log('sandbox', output.line), // $HighlightLine
})
await golangVersion.wait()
// output: [sandbox] /bin/bash: line 1: go: command not found

const procWithCustomHandler = await sandbox.process.start({
  cmd: 'go version',
  onStderr: (data) => console.log('process', data.line), // $HighlightLine
})
await procWithCustomHandler.wait()
// output: process /bin/bash: line 1: go: command not found

await sandbox.close()
