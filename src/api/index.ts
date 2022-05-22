import 'cross-fetch/polyfill'

import { Fetcher } from 'openapi-typescript-fetch'

import { SESSION_DOMAIN } from 'src/constants'
import type {
  paths,
  components,
} from './schema.gen'

const client = Fetcher.for<paths>()

client.configure({
  baseUrl: `https://${SESSION_DOMAIN}`,
})

export function getSessionURL(session: components['schemas']['Session'], port?: number) {
  const url = `${session.sessionID}-${session.clientID}.${SESSION_DOMAIN}`
  if (port) {
    return `${port}-${url}`
  } else {
    return url
  }
}

export default client
export type { components }
