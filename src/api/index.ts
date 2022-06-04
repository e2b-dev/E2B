import 'cross-fetch/polyfill'

import { Fetcher } from 'openapi-typescript-fetch'

import { SESSION_DOMAIN } from '../constants'
import type {
  paths,
  components,
} from './schema.gen'

const client = Fetcher.for<paths>()

client.configure({
  baseUrl: `https://${SESSION_DOMAIN}`,
})

export default client
export type { components, paths }
