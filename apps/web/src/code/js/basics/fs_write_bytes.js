import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({ template: 'base' })

// Let's convert string to bytes for testing purposes
const encoder = new TextEncoder('utf-8')
const contentInBytes = encoder.encode('Hello World!')

// `writeBytes` accepts a Uint8Array and saves it to a file inside the playground
await sandbox.filesystem.writeBytes('/file', contentInBytes) // $HighlightLine

// We can read the file back to verify the content
const fileContent = await sandbox.filesystem.read('/file')

// This will print 'Hello World!'
console.log(fileContent)

await sandbox.close()
