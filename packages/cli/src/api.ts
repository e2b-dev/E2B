import * as sdk from '@devbookhq/sdk'

const client: sdk.ClientType = sdk.api

client.configure({
  baseUrl: 'http://localhost:3000',
})

const apiKey = process.env.DEVBOOK_KEY

export function ensureAPIKey() {
  if (!apiKey) {
    process.exit(1)
  } else {
    return apiKey
  }
}

export { client, apiKey }
