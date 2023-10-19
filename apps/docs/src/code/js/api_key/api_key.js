import { Session } from '@e2b/sdk'

// You can pass an API key explicitly
const explicitAPIKey = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})
await explicitAPIKey.close()

// If you don't pass an API key, the SDK will look for it in the E2B_API_KEY environment variable
const APIKeyFromEnvVariable = await Session.create({
  id: 'Nodejs',
})
await APIKeyFromEnvVariable.close()
