import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({ template: 'base' })

// Timeout 3s for the write operation
await sandbox.filesystem.write('hello.txt', 'Hello World!', {timeout: 3000}) // $HighlightLine

// Timeout 3s for the list operation
const files = await sandbox.filesystem.list('.', {timeout: 3000}) // $HighlightLine
console.log(files)

// Timeout 3s for the read operation
const content = await sandbox.filesystem.read('hello.txt', {timeout: 3000}) // $HighlightLine
console.log(content)

await sandbox.close()
