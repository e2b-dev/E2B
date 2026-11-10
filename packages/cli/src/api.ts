import * as boxen from 'boxen'
import * as e2b from 'e2b'

import * as packageJSON from '../package.json'
import { getUserConfig, UserConfig } from './user'
import { asBold, asPrimary } from './utils/format'
import { ensureValidAccessToken, updateUserConfig } from './utils/token-refresh'
import { fetchMe, findProject, Me } from './workspaces'

// Must run before any ConnectionConfig is constructed (including the
// module-level one below) — configs read the integration at construction time.
e2b.ConnectionConfig.setIntegration(`e2b-cli/${packageJSON.version}`)

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
  | Required<Pick<e2b.ConnectionOpts, 'apiHeaders' | 'domain'>>

let me: Promise<Me> | undefined
let projectOverride: string | undefined
let apiKeyProjectWarned = false

/**
 * The `--project` value of the running command. Set once, before the action
 * runs, by the preAction hook in src/commands/index.ts.
 */
export function setProjectOverride(project: string | undefined) {
  projectOverride = project
}

/** The project reference to use instead of the selected one, if any. */
function requestedProject(): string | undefined {
  return projectOverride || projectId
}

/** Where the current project comes from; shown as `selected_by` in JSON. */
export enum ProjectSource {
  Flag = '--project',
  Env = 'E2B_PROJECT_ID',
  Selected = 'selected',
}

/**
 * The project commands run in and where that choice comes from, or
 * `undefined` when signed out without `--project` or `E2B_PROJECT_ID`.
 */
export function currentProject():
  { ref: string; source: ProjectSource } | undefined {
  if (projectOverride) {
    return { ref: projectOverride, source: ProjectSource.Flag }
  }
  if (projectId) return { ref: projectId, source: ProjectSource.Env }
  const config = getUserConfig()
  return config
    ? { ref: config.projectId, source: ProjectSource.Selected }
    : undefined
}

/** The logged-in user's workspaces and projects, fetched once per process. */
export function getMe(): Promise<Me> {
  me ??= (async () => {
    const { accessToken } = await ensureValidAccessToken()
    const result = await fetchMe(accessToken)
    if (!result) {
      throw new Error(
        'Your session was not accepted. Run `e2b auth login` again.'
      )
    }
    return result
  })()
  return me
}

/**
 * {@link getMe} for commands about workspaces and projects. workspace-api
 * only accepts the login's access token, so these need a login even when
 * `E2B_API_KEY` is set.
 */
export async function requireMe(): Promise<Me> {
  if (!getUserConfig()) {
    console.error(
      `You must be logged in to see your workspaces and projects. Run ${asBold(
        'e2b auth login'
      )}.`
    )
    process.exit(1)
  }
  return getMe()
}

/**
 * The project requests go to, and its control plane: `--project`, then
 * `E2B_PROJECT_ID`, then the project selected with `e2b project use`.
 */
async function resolveProject(
  config: UserConfig
): Promise<{ id: string; domain: string }> {
  const ref = requestedProject()
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
 * `E2B_API_KEY` wins, for CI/CD and other non-interactive use. Otherwise the
 * logged-in user's OAuth access token is used, refreshed first when it is
 * about to expire, with `X-Team-ID` selecting the project and requests sent
 * to that project's control plane (`domain`). Call this right before each
 * request (not once per command) so long-running commands keep working after
 * the hour-long access token expires.
 */
export async function ensureAuth(): Promise<Auth> {
  const apiKey = process.env.E2B_API_KEY
  if (apiKey) {
    if (projectOverride && !apiKeyProjectWarned) {
      apiKeyProjectWarned = true
      console.warn(
        `${asBold('--project')} is ignored when ${asBold(
          'E2B_API_KEY'
        )} is set: the API key determines the project.`
      )
    }
    return { apiKey }
  }

  if (!getUserConfig()) {
    console.error(authErrorBox())
    process.exit(1)
  }

  const { accessToken, config } = await ensureValidAccessToken()
  let project: { id: string; domain: string }
  try {
    project = await resolveProject(config)
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
export async function apiClient() {
  return new e2b.ApiClient(new e2b.ConnectionConfig(await ensureAuth()))
}

// Carries no credentials: used for the API domain and request signals only.
export const connectionConfig = new e2b.ConnectionConfig()
