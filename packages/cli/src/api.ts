import * as boxen from 'boxen'
import * as e2b from 'e2b'

import * as packageJSON from '../package.json'
import { getUserConfig, UserConfig } from './user'
import { asBold, asPrimary } from './utils/format'
import { ensureValidAccessToken } from './utils/token-refresh'

// Must run before any ConnectionConfig is constructed (including the
// module-level one below) — configs read the integration at construction time.
e2b.ConnectionConfig.setIntegration(`e2b-cli/${packageJSON.version}`)

export type Teams =
  e2b.paths['/teams']['get']['responses'][200]['content']['application/json']

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

/**
 * Credentials to spread into SDK call options, e.g. `Sandbox.list({ ...auth })`.
 * Derived from ConnectionOpts so a renamed SDK option fails to compile here
 * instead of being silently dropped by the spreads.
 */
export type Auth =
  | Required<Pick<e2b.ConnectionOpts, 'apiKey'>>
  | Required<Pick<e2b.ConnectionOpts, 'apiHeaders'>>

/**
 * Resolve credentials for an E2B API call.
 *
 * `E2B_API_KEY` wins, for CI/CD and other non-interactive use. Otherwise the
 * logged-in user's OAuth access token is used, refreshed first when it is
 * about to expire, with `X-Team-ID` selecting the project. Call this right
 * before each request (not once per command) so long-running commands keep
 * working after the hour-long access token expires.
 */
export async function ensureAuth(cliProjectId?: string): Promise<Auth> {
  const apiKey = process.env.E2B_API_KEY
  if (apiKey) return { apiKey }

  if (!getUserConfig()) {
    console.error(authErrorBox())
    process.exit(1)
  }

  const { accessToken, config } = await ensureValidAccessToken()
  return {
    apiHeaders: {
      Authorization: `Bearer ${accessToken}`,
      'X-Team-ID': resolveProjectId(cliProjectId) ?? config.projectId,
    },
  }
}

/** An E2B API client authenticated with {@link ensureAuth}. */
export async function apiClient(cliProjectId?: string) {
  return new e2b.ApiClient(
    new e2b.ConnectionConfig(await ensureAuth(cliProjectId))
  )
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

// Carries no credentials: used for the API domain and request signals only.
export const connectionConfig = new e2b.ConnectionConfig()
