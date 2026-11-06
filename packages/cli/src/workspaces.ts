import { select } from '@inquirer/prompts'
import { z } from 'zod'

import * as packageJSON from '../package.json'
import { asBold, asPrimary, asRed } from './utils/format'

// Only the fields the CLI uses. `status` and `kind` stay plain strings so a
// value added server-side doesn't break the CLI.
const projectSchema = z.object({
  id: z.string(),
  public_id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  slug: z.string(),
  region: z.string(),
  // The project's control plane: its API is `https://api.<domain>`.
  control_plane_domain: z.string(),
  status: z.string(),
  blocked: z.boolean(),
  block_reasons: z.array(z.string()),
  capabilities: z.array(z.string()),
})

const workspaceSchema = z.object({
  id: z.string(),
  public_id: z.string(),
  name: z.string(),
  kind: z.string(),
  blocked: z.boolean(),
  block_reasons: z.array(z.string()),
  capabilities: z.array(z.string()),
  projects: z.array(projectSchema),
})

const meSchema = z.object({ workspaces: z.array(workspaceSchema) })

export type Project = z.infer<typeof projectSchema>
export type Workspace = z.infer<typeof workspaceSchema>
export type Me = z.infer<typeof meSchema>

/** A project together with the workspace it is listed under. */
export type ProjectEntry = { project: Project; workspace: Workspace }

/**
 * Base URL of workspace-api, which owns workspaces and projects.
 *
 * It is only deployed at workspace-api.e2b.dev, also for the e2b.app API
 * domain the CLI defaults to. `E2B_WORKSPACE_API_URL` overrides it.
 */
export function workspaceApiUrl(): string {
  const override = process.env.E2B_WORKSPACE_API_URL
  if (override) return override.replace(/\/+$/, '')

  const domain = process.env.E2B_DOMAIN || 'e2b.dev'
  if (domain === 'e2b.app' || domain === 'e2b.dev') {
    return 'https://workspace-api.e2b.dev'
  }
  return `https://workspace-api.${domain}`
}

async function workspaceApi(
  method: 'GET' | 'POST',
  path: string,
  accessToken: string
): Promise<Response> {
  return fetch(`${workspaceApiUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': `e2b-cli/${packageJSON.version}`,
    },
    signal: AbortSignal.timeout(30_000),
  })
}

async function requestError(res: Response, action: string) {
  const body = await res.text().catch(() => '')
  return new Error(
    `Failed to ${action} (${res.status} from ${workspaceApiUrl()})${
      body ? `: ${body}` : ''
    }`
  )
}

/**
 * The caller's reachable workspaces and projects (`GET /v1/me`).
 *
 * Resolves to `undefined` on 401, which also means "not set up in
 * workspace-api yet" for a user who never opened the dashboard.
 */
export async function fetchMe(accessToken: string): Promise<Me | undefined> {
  const res = await workspaceApi('GET', '/v1/me', accessToken)
  if (res.status === 401) return undefined
  if (!res.ok) throw await requestError(res, 'list your workspaces')

  const parsed = meSchema.safeParse(await res.json())
  if (!parsed.success) {
    throw new Error(
      `Unexpected response from ${workspaceApiUrl()}/v1/me:\n${z.prettifyError(parsed.error)}`
    )
  }
  return parsed.data
}

/**
 * Create the account (a personal workspace with a first project, or SSO
 * workspace membership) for a signed-in user workspace-api doesn't know yet.
 * Idempotent: an existing account is returned unchanged.
 */
export async function bootstrapUser(accessToken: string): Promise<void> {
  const res = await workspaceApi('POST', '/v1/users/bootstrap', accessToken)
  if (!res.ok) throw await requestError(res, 'set up your account')
}

/** Every project in `me`, with its workspace. */
export function allProjects(me: Me): ProjectEntry[] {
  return me.workspaces.flatMap((workspace) =>
    workspace.projects.map((project) => ({ project, workspace }))
  )
}

/** Projects that can be used: provisioned and not being deleted. */
export function activeProjects(me: Me): ProjectEntry[] {
  return allProjects(me).filter(({ project }) => project.status === 'active')
}

/**
 * The project selected when none is chosen: the active project in the
 * personal workspace, the same rule workspace-api uses for `is_default` on the
 * control planes. SSO-only users have no personal workspace, so none.
 */
export function personalProject(me: Me): ProjectEntry | undefined {
  return activeProjects(me).find(
    ({ workspace }) => workspace.kind === 'personal'
  )
}

/**
 * Find a project by ID (UUID or `prj_` public ID), slug or name. Names are
 * matched case-insensitively and must be unambiguous.
 */
export function findProject(me: Me, ref: string): ProjectEntry {
  const entries = allProjects(me)
  const exact = entries.find(
    ({ project }) =>
      project.id === ref || project.public_id === ref || project.slug === ref
  )
  if (exact) return exact

  const byName = entries.filter(
    ({ project }) => project.name.toLowerCase() === ref.toLowerCase()
  )
  if (byName.length === 1) return byName[0]
  if (byName.length > 1) {
    throw new Error(
      `More than one project is named "${ref}": ${byName
        .map(
          ({ project, workspace }) => `${project.public_id} (${workspace.name})`
        )
        .join(', ')}. Pass the project ID instead.`
    )
  }
  throw new Error(
    `Project "${ref}" not found among the projects you can access. Run ${asBold(
      'e2b project list'
    )} to see them.`
  )
}

/** A warning to print for a blocked project, or `undefined`. */
export function blockedWarning({ project }: ProjectEntry): string | undefined {
  if (!project.blocked) return undefined
  const reasons = project.block_reasons.length
    ? ` (${project.block_reasons.join(', ')})`
    : ''
  return `Project ${project.name} is blocked${reasons}, so requests to it may be refused. Check the project in the dashboard.`
}

/** `name — workspace (region)`, flagged when blocked or currently selected. */
function projectLabel(
  { project, workspace }: ProjectEntry,
  selectedId?: string
): string {
  const flags = [
    project.blocked ? asRed('blocked') : undefined,
    project.id === selectedId ? asPrimary('current') : undefined,
  ].filter(Boolean)
  return `${asBold(project.name)} — ${workspace.name} (${project.region})${
    flags.length ? ` [${flags.join(', ')}]` : ''
  }`
}

/**
 * Ask which active project to use. Without a terminal to prompt in, or with
 * a single candidate, the first active project is returned.
 */
export async function pickProject(
  me: Me,
  { message, selectedId }: { message: string; selectedId?: string }
): Promise<ProjectEntry> {
  const entries = activeProjects(me)
  if (entries.length === 0) {
    throw new Error(
      `You don't have any active projects. Create one at ${asPrimary(
        'https://e2b.dev/dashboard'
      )}.`
    )
  }
  if (entries.length === 1 || !process.stdin.isTTY) return entries[0]

  return select({
    message,
    pageSize: 20,
    choices: entries.map((entry) => ({
      name: projectLabel(entry, selectedId),
      value: entry,
    })),
    default: entries.find(({ project }) => project.id === selectedId),
  })
}
