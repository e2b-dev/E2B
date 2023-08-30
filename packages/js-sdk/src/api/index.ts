import 'cross-fetch/polyfill'
import { Fetcher } from 'openapi-typescript-fetch'

import { API_DOMAIN } from '../constants'
import type { components, paths } from './schema.gen'

const client = Fetcher.for<paths>()

client.configure({
  baseUrl: `https://${API_DOMAIN}`,
})

type ClientType = typeof client

export default client
export type { components, paths, ClientType }
