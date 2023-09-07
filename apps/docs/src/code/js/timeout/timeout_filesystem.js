import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

// Timeout for the write operation
await session.filesystem.write('hello.txt', 'Hello World!', { timeout: 3000 })

// Timeout for the list operation
const files = await session.filesystem.list('.', { timeout: 3000 })

// Timeout for the read operation
const content = await session.filesystem.read('hello.txt', { timeout: 3000 })

await session.close()
