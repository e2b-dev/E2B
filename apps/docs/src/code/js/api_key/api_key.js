import { Session } from '@e2b/sdk'

const explicitAPIKey = await Session.create({
  id: 'Nodejs',
  apiKey: 'YOUR_API_KEY',
})
await explicitAPIKey.close()
