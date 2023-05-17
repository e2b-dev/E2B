import 'cross-fetch/polyfill'
import { Fetcher } from 'openapi-typescript-fetch'

import type { components, paths } from './schema.gen'
import { localURL } from 'db/credentials'

export const baseUrl = process.env.NEXT_PUBLIC_PROXY
  ? `${localURL}/api/service`
  : process.env.NEXT_PUBLIC_API_URL

const client = Fetcher.for<paths>()

client.configure({
  baseUrl,
})

type ClientType = typeof client

export default client
export type { components, paths, ClientType }
