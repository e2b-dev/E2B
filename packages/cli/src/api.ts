import * as boxen from 'boxen'
import * as e2b from 'e2b'

import { getUserConfig, UserConfig } from './user'
import { asBold, asPrimary } from './utils/format'

export let apiKey = process.env.E2B_API_KEY
export let accessToken = process.env.E2B_ACCESS_TOKEN
export const teamId = process.env.E2B_TEAM_ID

const authErrorBox = (keyName: 'E2B_API_KEY' | 'E2B_ACCESS_TOKEN' | 'BOTH') => {
  let body: string
  if (keyName === 'BOTH') {
    body = `You must be logged in to use this command. Run ${asBold(
      'e2b auth login'
    )}.

If you are seeing this message in CI/CD you may need to set either the ${asBold(
      'E2B_API_KEY'
    )} or ${asBold('E2B_ACCESS_TOKEN')} environment variable.
Visit ${asPrimary(
      'https://e2b.dev/dashboard?tab=keys'
    )} to get an API key or ${asPrimary(
      'https://e2b.dev/dashboard?tab=personal'
    )} to get an access token.`
  } else {
    const link =
      keyName === 'E2B_API_KEY'
        ? 'https://e2b.dev/dashboard?tab=keys'
        : 'https://e2b.dev/dashboard?tab=personal'
    const msg = keyName === 'E2B_API_KEY' ? 'API key' : 'access token'
    body = `You must be logged in to use this command. Run ${asBold(
      'e2b auth login'
    )}.

If you are seeing this message in CI/CD you may need to set the ${asBold(
      keyName
    )} environment variable.
Visit ${asPrimary(link)} to get the ${msg}.`
  }
  return boxen.default(body, {
    width: 70,
    float: 'center',
    padding: 0.5,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'redBright',
  })
}

export function ensureAPIKey() {
  // If apiKey is not already set (either from env var or from user config), try to get it from config file
  if (!apiKey) {
    const userConfig = getUserConfig()
    apiKey = userConfig?.teamApiKey
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

/**
 * Ensures either E2B_ACCESS_TOKEN or E2B_API_KEY is available. Use this for
 * endpoints that accept either credential at the API level. Returns whichever
 * is available, preferring access token.
 */
export function ensureAccessTokenOrAPIKey():
  | { accessToken: string; apiKey?: undefined }
  | { apiKey: string; accessToken?: undefined } {
  const userConfig = getUserConfig()
  if (!accessToken) {
    accessToken = userConfig?.accessToken
  }
  if (!apiKey) {
    apiKey = userConfig?.teamApiKey
  }

  if (accessToken) {
    return { accessToken }
  }
  if (apiKey) {
    return { apiKey }
  }

  console.error(authErrorBox('BOTH'))
  process.exit(1)
}

/**
 * Resolve team ID with proper precedence:
 * 1. CLI --team flag
 * 2. E2B_TEAM_ID env var
 * 3. Local e2b.toml team_id (if provided)
 * 4. ~/.e2b/config.json teamId (only if E2B_API_KEY env var is NOT set,
 *    to avoid mismatch between env var API key and config file team ID)
 */
export function resolveTeamId(
  cliTeamId?: string,
  localConfigTeamId?: string
): string | undefined {
  if (cliTeamId) return cliTeamId
  if (teamId) return teamId
  if (localConfigTeamId) return localConfigTeamId
  if (!process.env.E2B_API_KEY) {
    const config = getUserConfig()
    return config?.teamId
  }
  return undefined
}

const userConfig = getUserConfig()

export const connectionConfig = new e2b.ConnectionConfig({
  accessToken: process.env.E2B_ACCESS_TOKEN || userConfig?.accessToken,
  apiKey: process.env.E2B_API_KEY || userConfig?.teamApiKey,
})
export const client = new e2b.ApiClient(connectionConfig)
