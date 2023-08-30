import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

// This command will fail and output to stderr because Golang isn't installed in the cloud playground
const golangVersion = await session.process.start({
  cmd: 'go version',
  onStderr: output => console.log(output), // Print stderr to console
})
await golangVersion.finished

await session.close()