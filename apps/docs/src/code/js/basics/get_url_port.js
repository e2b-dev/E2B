import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

const url = session.getHostname(3000)
console.log('https://' + url)

await session.close()