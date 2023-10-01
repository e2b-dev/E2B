import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

// This command will fail and output to stderr because Golang isn't installed in the cloud playground
const golangVersion = await session.process.start({
  cmd: 'go version',
  onStderr: output => console.log('session', output.line), // $HighlightLine
})
await golangVersion.finished
// output: [session] /bin/bash: line 1: go: command not found

const procWithCustomHandler = await session.process.start({
  cmd: 'go version',
  onStderr: data => console.log('process', data.line), // $HighlightLine
})
await procWithCustomHandler.finished
// output: process /bin/bash: line 1: go: command not found

await session.close()
