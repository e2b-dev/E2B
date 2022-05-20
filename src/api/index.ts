import { Fetcher } from 'openapi-typescript-fetch'

import { API_URL } from 'src/constants'
import type { paths, components } from './schema.gen'

const client = Fetcher.for<paths>()

client.configure({
  baseUrl: API_URL,
})

export default client
export type { components }
