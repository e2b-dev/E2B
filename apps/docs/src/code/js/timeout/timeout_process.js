import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

// Timeout for the process to start
const npmInit = await session.process.start({
  cmd: 'npm init -y',
  timeout: 3000,
})
await npmInit.finished

await session.close()
