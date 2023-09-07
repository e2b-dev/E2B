import { Session } from '@e2b/sdk'

// Timeout for the session to open
const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
  timeout: 3000,
})

await session.close()
