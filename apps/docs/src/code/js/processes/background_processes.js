import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  template: 'base',
  apiKey: process.env.E2B_API_KEY,
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Start a server process in the background
// We are not calling `await backgroundServer` - that would wait for the process to finish running
const backgroundServer = await sandbox.process.start({
  // $HighlightLine
  cmd: 'python3 -m http.server 8000', // $HighlightLine
  onStdout: (output) => console.log(output), // $HighlightLine
}) // $HighlightLine

// Wait for the server to be accessible
await sleep(1000)

// Start another process that creates a request to server
const serverRequest = await sandbox.process.start({
  cmd: 'curl localhost:8000',
})

// Wait for the server request to finish running
const requestOutput = await serverRequest.wait()

// Stop the background process (it would otherwise run indefinitely)
await backgroundServer.kill() // $HighlightLine

// Access the server output after the server process is killed
const serverOutput = backgroundServer.output // $HighlightLine

await sandbox.close()
