import { UserConfigV3 } from './user'
import { handleE2BRequestError } from './utils/errors'

export interface Project {
  id: string
  name: string
  /** The domain of the project's control plane. */
  domain: string
  isDefault: boolean
}

const API_KEY_NAME = 'CLI login/configure'
const REQUEST_TIMEOUT_MS = 60_000

// They route every key to its control plane; a control plane's own domain
// accepts only its projects' keys.
const SHARED_DOMAINS = ['e2b.app', 'e2b.dev']

/**
 * The API that holds a project's keys: E2B_API_URL when set, as for every
 * other command, else the project's control plane.
 */
export function projectApiUrl(domain: string): string {
  return withoutTrailingSlash(
    process.env.E2B_API_URL || `https://api.${domain}`
  )
}

/**
 * Lists the caller's active projects from the workspace API: those E2B_DOMAIN
 * can reach when it names a control plane. The project in the personal
 * workspace is the default; without one, the first project is.
 */
export async function listProjects(accessToken: string): Promise<Project[]> {
  const workspaceApiUrl = withoutTrailingSlash(
    process.env.E2B_WORKSPACE_API_URL || 'https://workspace-api.e2b.dev'
  )
  const res = await fetch(`${workspaceApiUrl}/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  await assertOk(res, 'Error getting projects')

  const me = (await res.json()) as {
    workspaces: {
      kind: string
      projects: {
        id: string
        name: string
        status: string
        control_plane_domain: string
      }[]
    }[]
  }
  const domain = process.env.E2B_DOMAIN
  const projects = me.workspaces.flatMap((workspace) =>
    workspace.projects
      .filter((project) => project.status === 'active')
      .filter(
        (project) =>
          !domain ||
          SHARED_DOMAINS.includes(domain) ||
          project.control_plane_domain === domain
      )
      .map((project) => ({
        id: project.id,
        name: project.name,
        domain: project.control_plane_domain,
        isDefault: workspace.kind === 'personal',
      }))
  )
  if (projects.length > 0 && !projects.some((project) => project.isDefault)) {
    projects[0].isDefault = true
  }
  return projects
}

/** Creates an API key for the project. */
export async function createApiKey(
  accessToken: string,
  project: Project
): Promise<{ id: string; key: string }> {
  const res = await fetch(`${projectApiUrl(project.domain)}/api-keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Team-ID': project.id,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: API_KEY_NAME }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  await assertOk(res, 'Error creating project API key')
  const { id, key } = (await res.json()) as { id: string; key: string }
  return { id, key }
}

/**
 * Deletes the API key the CLI saved. A key that is already gone counts as
 * deleted; any other failure only warns, so it never blocks the command.
 */
export async function deleteApiKey(
  accessToken: string,
  config: UserConfigV3
): Promise<void> {
  try {
    const res = await fetch(
      `${projectApiUrl(config.project_domain)}/api-keys/${config.project_api_key_id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Team-ID': config.projectId,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    )
    if (res.status !== 404) await assertOk(res, 'Error deleting API key')
  } catch (err) {
    console.warn(
      `Could not delete the CLI's previous API key (${config.project_api_key_id}), delete it in the dashboard: ${
        err instanceof Error ? err.message : err
      }`
    )
  }
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

async function assertOk(res: Response, errMsg: string): Promise<void> {
  if (res.ok) return
  const body = (await res.json().catch(() => ({}))) as { message?: string }
  handleE2BRequestError(
    { error: { code: res.status, message: body.message || res.statusText } },
    errMsg
  )
}
