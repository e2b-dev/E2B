import * as boxen from 'boxen'
import * as e2b from 'e2b'

import { getUserConfig, UserConfig } from './user'
import { asBold, asPrimary } from './utils/format'

export let apiKey = process.env.E2B_API_KEY
export let accessToken = process.env.E2B_ACCESS_TOKEN

const authErrorBox = (keyName: string) => {
  switch (keyName) {
    case 'E2B_API_KEY':
      return boxen.default(
        `You must be logged in to use this command. Run ${asBold('e2b auth login')}.
    
    If you are seeing this message in CI/CD you may need to set the ${asBold(
          `${keyName}`
        )} environment variable.
    Visit ${asPrimary(
          'https://e2b.dev/dashboard?tab=keys'
        )} to get the access token.`,
        {
          width: 70,
          float: 'center',
          padding: 0.5,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'redBright',
        }
      )
    case 'E2B_ACCESS_TOKEN':
      return boxen.default(
        `You must be logged in to use this command. Run ${asBold('e2b auth login')}.
    
    If you are seeing this message in CI/CD you may need to set the ${asBold(
          `${keyName}`
        )} environment variable.
    Visit ${asPrimary(
          'https://e2b.dev/dashboard?tab=personal'
        )} to get the access token.`,
        {
          width: 70,
          float: 'center',
          padding: 0.5,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'redBright',
        }
      )
    default:
      throw new Error(`Unknown key name: ${keyName}`)
  }
}

export function ensureAPIKey() {
  // If apiKey is not already set (either from env var or from user config), try to get it from config file
  if (!apiKey) {
    const userConfig = getUserConfig()
    apiKey = userConfig?.teamApiKey || userConfig?.defaultTeamApiKey
  }

  if (!apiKey) {
    console.error(authErrorBox('E2B_API_KEY'))
    process.exit(1)
  } else {
    return apiKey
  }
}

export function ensureUserConfig(): UserConfig {
  const userConfig = getUserConfig()
  if (!userConfig) {
    console.error('No user config found, run `e2b auth login` to log in first.')
    process.exit(1)
  }
  return userConfig
}

export function ensureAccessToken() {
  // If accessToken is not already set (either from env var or from user config), try to get it from config file
  if (!accessToken) {
    const userConfig = getUserConfig()
    accessToken = userConfig?.accessToken
  }

  if (!accessToken) {
    console.error(authErrorBox('E2B_ACCESS_TOKEN'))
    process.exit(1)
  } else {
    return accessToken
  }
}

const userConfig = getUserConfig()

export const connectionConfig = new e2b.ConnectionConfig({
  accessToken: process.env.E2B_ACCESS_TOKEN || userConfig?.accessToken,
  apiKey: process.env.E2B_API_KEY || userConfig?.teamApiKey,
})
export const client = new e2b.ApiClient(connectionConfig)
