import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Python3',
  apiKey: process.env.E2B_API_KEY,
})

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start a server process in the background
// We are not calling `await backgroundServer` - that would wait for the process to finish running
const backgroundServer = await session.process.start({ // $HighlightLine
  cmd: 'python3 -m http.server 8000', // $HighlightLine
  onStdout: output => console.log(output), // $HighlightLine
}) // $HighlightLine

// Wait for the server to be accessible
await sleep(1000)

// Start another process that creates a request to server
const serverRequest = await session.process.start({ cmd: 'curl localhost:8000' })

// Wait for the server request to finish running
const requestOutput = await serverRequest.finished

// Stops the background process (it would otherwise run indefinitely). After this the backgroundServer.output should be populated with stdout and stderr that were outputted until the server was killed
await backgroundServer.kill() // $HighlightLine

// Access the server output after the server process is killed
const serverOutput = backgroundServer.output  // $HighlightLine

console.log(requestOutput)

await session.close()
