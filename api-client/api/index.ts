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
  init: {
    headers: {
      // Add token to all requests if it's set (server-side only)
      ...process.env.SECRET_TOKEN && {
        'Authorization': `Bearer ${process.env.SECRET_TOKEN}`,
      },
    },
  },
})

type ClientType = typeof client

export default client
export type { components, paths, ClientType }
