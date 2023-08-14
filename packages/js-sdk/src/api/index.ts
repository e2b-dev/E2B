import 'cross-fetch/polyfill'
import { Fetcher } from 'openapi-typescript-fetch'

import { SESSION_DOMAIN } from '../constants'
import type { components, paths } from './schema.gen'

const client = Fetcher.for<paths>()

client.configure({
  baseUrl: `https://${SESSION_DOMAIN}`,
})

type ClientType = typeof client

export default client
export type { components, paths, ClientType }
