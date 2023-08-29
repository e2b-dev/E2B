import { Session } from '@e2b/sdk'

const E2B_API_KEY = process.env.E2B_API_KEY

const session = await Session.create({
  id: 'Nodejs',
  apiKey: E2B_API_KEY,
})
await session.close()
