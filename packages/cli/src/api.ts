import * as boxen from 'boxen'
import * as e2b from 'e2b'

import { getUserConfig, saveUserConfig, UserConfig } from './user'
import { asBold, asPrimary } from './utils/format'

export let apiKey = process.env.E2B_API_KEY
export let accessToken = process.env.E2B_ACCESS_TOKEN
export let domain: string | undefined = process.env.E2B_DOMAIN
export const teamId = process.env.E2B_TEAM_ID
export let currentProfileName: string = 'default'

const authErrorBox = (keyName: string) => {
  let link
  let msg
  switch (keyName) {
    case 'E2B_API_KEY':
      link = 'https://e2b.dev/dashboard?tab=keys'
      msg = 'API key'
      break
    case 'E2B_ACCESS_TOKEN':
      link = 'https://e2b.dev/dashboard?tab=personal'
      msg = 'access token'
      break
  }
  // throwing error in default in switch statement results in unreachable code,
  // so we need to check if link and msg are defined here instead
  if (!link || !msg) {
    throw new Error(`Unknown key name: ${keyName}`)
  }
  return boxen.default(
    `You must be logged in to use this command. Run ${asBold('e2b auth login')}.

If you are seeing this message in CI/CD you may need to set the ${asBold(
      `${keyName}`
    )} environment variable.
Visit ${asPrimary(link)} to get the ${msg}.`,
    {
      width: 70,
      float: 'center',
      padding: 0.5,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'redBright',
    }
  )
}

function buildConnectionConfig() {
  return new e2b.ConnectionConfig({
    accessToken,
    apiKey,
    domain,
  })
}

// Initialize from the default profile at startup
const _defaultConfig = getUserConfig('default')
if (!process.env.E2B_API_KEY) apiKey = _defaultConfig?.teamApiKey
if (!process.env.E2B_ACCESS_TOKEN) accessToken = _defaultConfig?.accessToken
if (!process.env.E2B_DOMAIN) domain = _defaultConfig?.domain

export let connectionConfig = buildConnectionConfig()
export let client = new e2b.ApiClient(connectionConfig)

export function setProfile(profileName: string) {
  currentProfileName = profileName
  const config = getUserConfig(profileName)
  if (!config) {
    console.error(`Profile '${profileName}' not found in ~/.e2b/config`)
    process.exit(1)
  }
  if (!process.env.E2B_API_KEY) apiKey = config.teamApiKey
  if (!process.env.E2B_ACCESS_TOKEN) accessToken = config.accessToken
  if (!process.env.E2B_DOMAIN) domain = config.domain
  connectionConfig = buildConnectionConfig()
  client = new e2b.ApiClient(connectionConfig)
}

export function ensureAPIKey() {
  if (!apiKey) {
    const config = getUserConfig(currentProfileName)
    apiKey = config?.teamApiKey
  }

  if (!apiKey) {
    console.error(authErrorBox('E2B_API_KEY'))
    process.exit(1)
  } else {
    return apiKey
  }
}

export function ensureUserConfig(): UserConfig {
  const userConfig = getUserConfig(currentProfileName)
  if (!userConfig) {
    console.error('No user config found, run `e2b auth login` to log in first.')
    process.exit(1)
  }
  return userConfig
}

export function ensureAccessToken() {
  if (!accessToken) {
    const config = getUserConfig(currentProfileName)
    accessToken = config?.accessToken
  }

  if (!accessToken) {
    console.error(authErrorBox('E2B_ACCESS_TOKEN'))
    process.exit(1)
  } else {
    return accessToken
  }
}

/**
 * Resolve team ID with proper precedence:
 * 1. CLI --team flag
 * 2. E2B_TEAM_ID env var
 * 3. Local e2b.toml team_id (if provided)
 * 4. Profile config teamId (only if E2B_API_KEY env var is NOT set,
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
    const config = getUserConfig(currentProfileName)
    return config?.teamId
  }
  return undefined
}

export { saveUserConfig }
