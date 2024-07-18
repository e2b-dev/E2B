import { Sandbox } from 'e2b'

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const sandbox = await Sandbox.create({ template: 'base' })

// Do something in the sandbox
await sandbox.filesystem.write('hello.txt', 'Hello World!')

// Get the sandbox ID, we'll need it later
const sandboxID = sandbox.id

// Keep alive the sandbox for 2 minutes
await sandbox.keepAlive(2 * 60 * 1000) // 2 * minutes $HighlightLine

// Close the sandbox
await sandbox.close()

// Do something else...
await wait(60 * 1000)

// Reconnect to the sandbox
const sandbox2 = await Sandbox.reconnect(sandboxID) // $HighlightLine

// Continue in using the sandbox
const content = await sandbox2.filesystem.read('hello.txt')
console.log(content)

// Close the sandbox
await sandbox2.close()
