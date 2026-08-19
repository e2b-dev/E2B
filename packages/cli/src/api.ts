import * as boxen from 'boxen'
import * as e2b from 'e2b'

import * as packageJSON from '../package.json'
import { getUserConfig, UserConfig } from './user'
import { asBold, asPrimary } from './utils/format'

// Must run before any ConnectionConfig is constructed (including the
// module-level one below) — configs read the integration at construction time.
e2b.ConnectionConfig.setIntegration(`e2b-cli/${packageJSON.version}`)

export type Teams =
  e2b.paths['/teams']['get']['responses'][200]['content']['application/json']

export let apiKey = process.env.E2B_API_KEY
export const projectId = process.env.E2B_PROJECT_ID || process.env.E2B_TEAM_ID

const authErrorBox = () => {
  const body = `You must be logged in to use this command. Run ${asBold(
    'e2b auth login'
  )}.

If you are seeing this message in CI/CD you may need to set the ${asBold(
    'E2B_API_KEY'
  )} environment variable.
Visit ${asPrimary('https://e2b.dev/dashboard?tab=keys')} to get the API key.`
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
    apiKey = userConfig?.projectApiKey
  }

  if (!apiKey) {
    console.error(authErrorBox())
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

/**
 * Resolve project ID with proper precedence:
 * 1. CLI --project flag (or the deprecated --team flag)
 * 2. E2B_PROJECT_ID env var (or the deprecated E2B_TEAM_ID)
 * 3. ~/.e2b/config.json projectId (only if E2B_API_KEY env var is NOT set,
 *    to avoid mismatch between env var API key and config file project ID)
 */
export function resolveProjectId(cliProjectId?: string): string | undefined {
  if (cliProjectId) return cliProjectId
  if (projectId) return projectId
  if (!process.env.E2B_API_KEY) {
    const config = getUserConfig()
    return config?.projectId
  }
  return undefined
}

const userConfig = getUserConfig()

export const connectionConfig = new e2b.ConnectionConfig({
  apiKey: process.env.E2B_API_KEY || userConfig?.projectApiKey,
})

// `e2b auth login` runs before any API key exists, and this client is built at
// import time, so don't require an API key here.
export const client = new e2b.ApiClient(connectionConfig, {
  requireApiKey: false,
})
