import { api, ClientType } from '@devbookhq/sdk'

const client: ClientType = api

client.configure({
  baseUrl: 'http://localhost:3000',
})

export default client
