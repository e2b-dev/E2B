import * as boxen from 'boxen'
import * as e2b from 'e2b'

import * as packageJSON from '../package.json'
import { getUserConfig, UserConfig } from './user'
import { asBold, asPrimary } from './utils/format'
import {
  decodeJwtExp,
  ensureValidAccessToken,
  updateUserConfig,
} from './utils/token-refresh'
import { defaultProject, fetchMe, findProject, Me } from './workspaces'

// Must run before any ConnectionConfig is constructed (including the
// module-level one below) — configs read the integration at construction time.
e2b.ConnectionConfig.setIntegration(`e2b-cli/${packageJSON.version}`)

export const projectId = process.env.E2B_PROJECT_ID || process.env.E2B_TEAM_ID

/**
 * An OAuth access token given instead of logging in. It is used as is (there
 * is no refresh token to renew it with), and the stored login is ignored.
 */
export const envAccessToken = process.env.E2B_ACCESS_TOKEN || undefined

const authErrorBox = () => {
  const body = `You must be logged in to use this command. Run ${asBold(
    'e2b auth login'
  )}.

If you are seeing this message in CI/CD you may need to set the ${asBold(
    'E2B_API_KEY'
  )} (or ${asBold('E2B_ACCESS_TOKEN')}) environment variable.
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
  | Required<Pick<e2b.ConnectionOpts, 'apiHeaders' | 'domain'>>

let me: Promise<Me> | undefined

/**
 * The project commands run in: `E2B_PROJECT_ID`, else the one selected with
 * `e2b project use`. `undefined` when signed out, or with `E2B_ACCESS_TOKEN`
 * (which ignores the stored login), without `E2B_PROJECT_ID`.
 */
export function currentProject(): string | undefined {
  if (projectId) return projectId
  return envAccessToken ? undefined : getUserConfig()?.projectId
}

/**
 * `E2B_API_KEY` and `E2B_ACCESS_TOKEN` select different projects (the key's
 * own, the token's user's), so both at once is a mistake, not a precedence.
 */
export const CONFLICTING_CREDENTIALS = `Both ${asBold('E2B_API_KEY')} and ${asBold(
  'E2B_ACCESS_TOKEN'
)} are set. Unset one of them.`

export function envCredentialsConflict(): boolean {
  return Boolean(process.env.E2B_API_KEY && envAccessToken)
}

/**
 * `E2B_ACCESS_TOKEN`, checked to be an OAuth access token (a JWT: the same
 * variable used to hold the dashboard's access tokens, which no longer
 * work) that hasn't expired, since it can't be refreshed.
 */
function checkedEnvAccessToken(): string {
  const exp = decodeJwtExp(envAccessToken!)
  if (!exp) {
    throw new Error(
      `${asBold('E2B_ACCESS_TOKEN')} is not an OAuth access token. Access tokens from the dashboard are no longer supported: unset it and run ${asBold(
        'e2b auth login'
      )}, or use ${asBold('E2B_API_KEY')}.`
    )
  }
  if (Math.floor(Date.now() / 1000) >= exp) {
    throw new Error(
      `${asBold('E2B_ACCESS_TOKEN')} has expired. Set a current one, or unset it and run ${asBold(
        'e2b auth login'
      )}.`
    )
  }
  return envAccessToken!
}

/** The user's workspaces and projects, fetched once per process. */
export function getMe(): Promise<Me> {
  me ??= (async () => {
    const accessToken = envAccessToken
      ? checkedEnvAccessToken()
      : (await ensureValidAccessToken()).accessToken
    const result = await fetchMe(accessToken)
    if (!result) {
      throw new Error(
        envAccessToken
          ? `${asBold('E2B_ACCESS_TOKEN')} was rejected. Set a current access token.`
          : 'Your session was not accepted. Run `e2b auth login` again.'
      )
    }
    return result
  })()
  return me
}

/**
 * {@link getMe} for commands about workspaces and projects. workspace-api
 * only accepts an access token, so these need a login or `E2B_ACCESS_TOKEN`
 * even when `E2B_API_KEY` is set.
 */
export async function requireMe(): Promise<Me> {
  if (envCredentialsConflict()) {
    console.error(CONFLICTING_CREDENTIALS)
    process.exit(1)
  }
  if (!envAccessToken && !getUserConfig()) {
    console.error(
      `You must be logged in to see your workspaces and projects. Run ${asBold(
        'e2b auth login'
      )} or set ${asBold('E2B_ACCESS_TOKEN')}.`
    )
    process.exit(1)
  }
  try {
    return await getMe()
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

/**
 * The project requests with `E2B_ACCESS_TOKEN` go to: `cliProjectId`, then
 * `E2B_PROJECT_ID`, else the default project the token's user has.
 */
async function resolveEnvProject(
  cliProjectId?: string
): Promise<{ id: string; domain: string }> {
  const me = await getMe()
  const ref = cliProjectId || projectId
  const { project } = ref ? findProject(me, ref) : defaultProject(me)
  return { id: project.id, domain: project.control_plane_domain }
}

/**
 * The project requests go to, and its control plane: `cliProjectId`, then
 * `E2B_PROJECT_ID`, then the project selected with `e2b project use`.
 */
async function resolveProject(
  config: UserConfig,
  cliProjectId?: string
): Promise<{ id: string; domain: string }> {
  const ref = cliProjectId || projectId
  if (ref && ref !== config.projectId) {
    const { project } = findProject(await getMe(), ref)
    return { id: project.id, domain: project.control_plane_domain }
  }
  if (config.projectDomain) {
    return { id: config.projectId, domain: config.projectDomain }
  }

  // Selected before the CLI stored control-plane domains: look it up once.
  const { project } = findProject(await getMe(), config.projectId)
  // Only for the project still selected: `e2b auth configure` may have
  // switched to another one since `config` was read.
  await updateUserConfig((current) =>
    current.projectId === project.id
      ? { projectDomain: project.control_plane_domain }
      : {}
  )
  return { id: project.id, domain: project.control_plane_domain }
}

/**
 * Resolve credentials for an E2B API call.
 *
 * `E2B_API_KEY` or `E2B_ACCESS_TOKEN`, for CI/CD and other non-interactive
 * use (setting both is refused), each ignoring the stored login. Otherwise
 * the logged-in user's OAuth access token is used, refreshed first when it
 * is about to expire. With a token, `X-Team-ID`
 * selects the project and requests go to that project's control plane
 * (`domain`). Call this right before each request (not once per command) so
 * long-running commands keep working after the hour-long access token
 * expires.
 */
export async function ensureAuth(cliProjectId?: string): Promise<Auth> {
  if (envCredentialsConflict()) {
    console.error(CONFLICTING_CREDENTIALS)
    process.exit(1)
  }
  const apiKey = process.env.E2B_API_KEY
  if (apiKey) return { apiKey }

  if (envAccessToken) {
    try {
      const project = await resolveEnvProject(cliProjectId)
      return {
        apiHeaders: {
          Authorization: `Bearer ${checkedEnvAccessToken()}`,
          'X-Team-ID': project.id,
        },
        domain: project.domain,
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    }
  }

  if (!getUserConfig()) {
    console.error(authErrorBox())
    process.exit(1)
  }

  const { accessToken, config } = await ensureValidAccessToken()
  let project: { id: string; domain: string }
  try {
    project = await resolveProject(config, cliProjectId)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }

  return {
    apiHeaders: {
      Authorization: `Bearer ${accessToken}`,
      'X-Team-ID': project.id,
    },
    domain: project.domain,
  }
}

/** An E2B API client authenticated with {@link ensureAuth}. */
export async function apiClient(cliProjectId?: string) {
  return new e2b.ApiClient(
    new e2b.ConnectionConfig(await ensureAuth(cliProjectId))
  )
}

// Carries no credentials: used for the API domain and request signals only.
export const connectionConfig = new e2b.ConnectionConfig()
