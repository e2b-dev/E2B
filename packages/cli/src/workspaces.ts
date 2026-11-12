import { select } from './utils/prompts'
import { ConnectionConfig } from 'e2b'
import createClient from 'openapi-fetch'

import * as packageJSON from '../package.json'
import { asBold, asPrimary, asRed } from './utils/format'
import type { components, paths } from './workspace-api/schema.gen'

const WORKSPACE_API_REQUEST_TIMEOUT_MS = 30_000

type ApiProject = components['schemas']['Project']
type ApiWorkspace = components['schemas']['Workspace']

// Only the fields the CLI uses, so `--format json` output doesn't grow with
// every field workspace-api adds.
export type Project = Pick<
  ApiProject,
  | 'id'
  | 'public_id'
  | 'workspace_id'
  | 'name'
  | 'slug'
  | 'region'
  | 'control_plane_domain'
  | 'status'
  | 'blocked'
  | 'block_reasons'
  | 'capabilities'
>
export type Workspace = Pick<
  ApiWorkspace,
  | 'id'
  | 'public_id'
  | 'name'
  | 'kind'
  | 'blocked'
  | 'block_reasons'
  | 'capabilities'
> & { projects: Project[] }
export type Me = { workspaces: Workspace[] }

/** The `status` values the CLI acts on. */
export enum ProjectStatus {
  Active = 'active',
}

/** The workspace `kind` values the CLI acts on. */
export enum WorkspaceKind {
  Personal = 'personal',
}

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

  // The same resolution as the SDK: E2B_DOMAIN, then its default.
  const domain = new ConnectionConfig().domain
  if (domain === 'e2b.app' || domain === 'e2b.dev') {
    return 'https://workspace-api.e2b.dev'
  }
  return `https://workspace-api.${domain}`
}

function workspaceApi(accessToken: string) {
  return createClient<paths>({
    baseUrl: workspaceApiUrl(),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': `e2b-cli/${packageJSON.version}`,
    },
  })
}

function requestError(res: Response, body: unknown, action: string) {
  const detail =
    (typeof body === 'string' ? body : JSON.stringify(body)) || res.statusText
  return new Error(
    `Failed to ${action} (${res.status} from ${workspaceApiUrl()})${
      detail ? `: ${detail}` : ''
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
  const { data, error, response } = await workspaceApi(accessToken).GET(
    '/v1/me',
    { signal: AbortSignal.timeout(WORKSPACE_API_REQUEST_TIMEOUT_MS) }
  )
  if (response.status === 401) return undefined
  if (!response.ok || data === undefined) {
    throw requestError(response, error, 'list your workspaces')
  }
  return { workspaces: data.workspaces.map(toWorkspace) }
}

function toProject(p: ApiProject): Project {
  return {
    id: p.id,
    public_id: p.public_id,
    workspace_id: p.workspace_id,
    name: p.name,
    slug: p.slug,
    region: p.region,
    control_plane_domain: p.control_plane_domain,
    status: p.status,
    blocked: p.blocked,
    block_reasons: p.block_reasons,
    capabilities: p.capabilities,
  }
}

function toWorkspace(w: ApiWorkspace): Workspace {
  return {
    id: w.id,
    public_id: w.public_id,
    name: w.name,
    kind: w.kind,
    blocked: w.blocked,
    block_reasons: w.block_reasons,
    capabilities: w.capabilities,
    projects: w.projects.map(toProject),
  }
}

/** Every project in `me`, with its workspace. */
export function allProjects(me: Me): ProjectEntry[] {
  return me.workspaces.flatMap((workspace) =>
    workspace.projects.map((project) => ({ project, workspace }))
  )
}

/** Projects that can be used: provisioned and not being deleted. */
export function activeProjects(me: Me): ProjectEntry[] {
  return allProjects(me).filter(
    ({ project }) => project.status === ProjectStatus.Active
  )
}

/**
 * The project selected when none is chosen: the active project in the
 * personal workspace, the same rule workspace-api uses for `is_default` on the
 * control planes. SSO-only users have no personal workspace, so none.
 */
export function personalProject(me: Me): ProjectEntry | undefined {
  return activeProjects(me).find(
    ({ workspace }) => workspace.kind === WorkspaceKind.Personal
  )
}

/** Find a workspace by ID (UUID or `wrk_` public ID) or unambiguous name. */
export function findWorkspace(me: Me, ref: string): Workspace {
  const exact = me.workspaces.find((w) => w.id === ref || w.public_id === ref)
  if (exact) return exact
  const byName = me.workspaces.filter(
    (w) => w.name.toLowerCase() === ref.toLowerCase()
  )
  if (byName.length === 1) return byName[0]
  if (byName.length > 1) {
    throw new Error(
      `More than one workspace is named "${ref}": ${byName
        .map((w) => w.public_id)
        .join(', ')}. Pass the workspace ID instead.`
    )
  }
  throw new Error(
    `Workspace "${ref}" not found. Run ${asBold(
      'e2b workspace list'
    )} to see your workspaces.`
  )
}

/**
 * Find a project by ID (UUID or `prj_` public ID), slug or name, among the
 * projects of `workspace` when given. Names are matched case-insensitively
 * and must be unambiguous.
 */
export function findProject(
  me: Me,
  ref: string,
  workspace?: Workspace
): ProjectEntry {
  const entries = allProjects(me).filter(
    (entry) => !workspace || entry.workspace.id === workspace.id
  )
  const byId = entries.find(
    ({ project }) => project.id === ref || project.public_id === ref
  )
  if (byId) return byId

  // Slugs are unique within a workspace, names not even there; across
  // workspaces either can repeat.
  const bySlug = entries.filter(({ project }) => project.slug === ref)
  const matches = bySlug.length
    ? bySlug
    : entries.filter(
        ({ project }) => project.name.toLowerCase() === ref.toLowerCase()
      )
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    throw new Error(
      `More than one project matches "${ref}": ${matches
        .map(
          ({ project, workspace }) => `${project.public_id} (${workspace.name})`
        )
        .join(', ')}. Pass the project ID instead.`
    )
  }
  throw new Error(
    `Project "${ref}" not found among the projects you can access${
      workspace ? ` in workspace ${workspace.name}` : ''
    }. Run ${asBold('e2b project list')} to see them.`
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

/** `name (region)`, flagged when blocked or currently selected. */
function projectLabel({ project }: ProjectEntry, selectedId?: string): string {
  const flags = [
    project.blocked ? asRed('blocked') : undefined,
    project.id === selectedId ? asPrimary('current') : undefined,
  ].filter(Boolean)
  return `${asBold(project.name)} (${project.region})${
    flags.length ? ` [${flags.join(', ')}]` : ''
  }`
}

/** `name (kind, N active projects)`, flagged when it holds the selected project. */
function workspaceLabel(
  workspace: Workspace,
  entries: ProjectEntry[],
  selectedId?: string
): string {
  const own = entries.filter((entry) => entry.workspace.id === workspace.id)
  const count = `${own.length} active project${own.length === 1 ? '' : 's'}`
  const current = own.some(({ project }) => project.id === selectedId)
  return `${asBold(workspace.name)} (${workspace.kind}, ${count})${
    current ? ` [${asPrimary('current')}]` : ''
  }`
}

/**
 * Ask which active project to use: first the workspace, then one of its
 * projects, each step shown even with a single choice. With `workspace` only
 * its projects are offered. Without a terminal to prompt in, the currently
 * selected project is kept if it is a candidate, else the first one is
 * returned.
 */
export async function pickProject(
  me: Me,
  {
    message,
    selectedId,
    workspace,
  }: { message: string; selectedId?: string; workspace?: Workspace }
): Promise<ProjectEntry> {
  const entries = activeProjects(me).filter(
    (entry) => !workspace || entry.workspace.id === workspace.id
  )
  if (entries.length === 0) {
    throw new Error(
      workspace
        ? `Workspace ${workspace.name} has no active projects.`
        : `You don't have any active projects. Create one at ${asPrimary(
            'https://e2b.dev/dashboard'
          )}.`
    )
  }
  const current = entries.find(({ project }) => project.id === selectedId)
  if (!process.stdin.isTTY) return current ?? entries[0]

  const workspaces = me.workspaces.filter((candidate) =>
    entries.some((entry) => entry.workspace.id === candidate.id)
  )
  const chosen =
    workspace ??
    (await select({
      message: 'Select workspace',
      maxItems: 20,
      options: workspaces.map((candidate) => ({
        label: workspaceLabel(candidate, entries, selectedId),
        value: candidate,
      })),
      initialValue: current?.workspace,
    }))

  const candidates = entries.filter((entry) => entry.workspace.id === chosen.id)
  return select({
    message,
    maxItems: 20,
    options: candidates.map((entry) => ({
      label: projectLabel(entry, selectedId),
      value: entry,
    })),
    initialValue: current?.workspace.id === chosen.id ? current : undefined,
  })
}
