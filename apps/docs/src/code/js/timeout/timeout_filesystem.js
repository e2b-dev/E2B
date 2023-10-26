import { Session } from '@e2b/sdk'

const session = await Session.create({ id: 'Nodejs' })

// Timeout 3s for the write operation
await session.filesystem.write('hello.txt', 'Hello World!', { timeout: 3000 }) // $HighlightLine

// Timeout 3s for the list operation
const files = await session.filesystem.list('.', { timeout: 3000 }) // $HighlightLine
console.log(files)

// Timeout 3s for the read operation
const content = await session.filesystem.read('hello.txt', { timeout: 3000 }) // $HighlightLine
console.log(content)

await session.close()
