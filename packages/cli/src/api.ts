import * as boxen from 'boxen'

import { getUserConfig } from './user'
import { asBold, asPrimary } from './utils/format'

export let apiKey = process.env.E2B_API_KEY
export let accessToken = process.env.E2B_ACCESS_TOKEN

const authErrorBox = boxen.default(
  `You must be logged in to use this command. Run ${asBold('e2b login')}.

If you are seeing this message in CI/CD you may need to set the ${asBold('E2B_ACCESS_TOKEN')} environment variable.
Visit ${asPrimary('https://e2b.dev/docs/getting-started/api-key')} to get the access token.`,
  {
    width: 70,
    float: 'center',
    padding: 0.5,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'redBright',
  },
)

export function ensureAPIKey() {
  // If apiKey is not already set (either from env var or from user config), try to get it from config file
  if (!apiKey) {
    const userConfig = getUserConfig()
    apiKey = userConfig?.defaultTeamApiKey
  }

  if (!apiKey) {
    console.error(authErrorBox)
    process.exit(1)
  } else {
    return apiKey
  }
}

export function ensureAccessToken() {
  // If accessToken is not already set (either from env var or from user config), try to get it from config file
  if (!accessToken) {
    const userConfig = getUserConfig()
    accessToken = userConfig?.accessToken
  }

  if (!accessToken) {
    console.error(authErrorBox)
    process.exit(1)
  } else {
    return accessToken
  }
}
