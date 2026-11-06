import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  activeProjects,
  blockedWarning,
  fetchMe,
  findProject,
  Me,
  personalProject,
  pickProject,
  Project,
  Workspace,
  workspaceApiUrl,
} from '../src/workspaces'

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    public_id: `prj_${id}`,
    workspace_id: 'ws',
    name: `Project ${id}`,
    slug: `slug-${id}`,
    region: 'us-west-1',
    control_plane_domain: 'e2b-foxtrot.dev',
    status: 'active',
    blocked: false,
    block_reasons: [],
    capabilities: [],
    ...overrides,
  }
}

function workspace(
  kind: string,
  projects: Project[],
  overrides: Partial<Workspace> = {}
): Workspace {
  return {
    id: kind,
    public_id: `wrk_${kind}`,
    name: `${kind} workspace`,
    kind,
    blocked: false,
    block_reasons: [],
    capabilities: [],
    projects,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('workspaceApiUrl', () => {
  test.each([
    ['', 'https://workspace-api.e2b.dev'],
    ['e2b.app', 'https://workspace-api.e2b.dev'],
    ['e2b.dev', 'https://workspace-api.e2b.dev'],
    ['example.com', 'https://workspace-api.example.com'],
  ])('maps E2B_DOMAIN=%j to %s', (domain: string, url: string) => {
    vi.stubEnv('E2B_WORKSPACE_API_URL', '')
    vi.stubEnv('E2B_DOMAIN', domain)
    expect(workspaceApiUrl()).toBe(url)
  })

  test('E2B_WORKSPACE_API_URL overrides it', () => {
    vi.stubEnv('E2B_DOMAIN', 'e2b.app')
    vi.stubEnv('E2B_WORKSPACE_API_URL', 'http://localhost:8080/')
    expect(workspaceApiUrl()).toBe('http://localhost:8080')
  })
})

describe('personalProject', () => {
  test('picks the active project in the personal workspace', () => {
    const me: Me = {
      workspaces: [
        workspace('standard', [project('team')]),
        workspace('personal', [
          project('deleting', { status: 'deleting' }),
          project('mine'),
        ]),
      ],
    }
    expect(personalProject(me)?.project.id).toBe('mine')
  })

  test('is undefined for SSO-only users', () => {
    const me: Me = { workspaces: [workspace('standard', [project('team')])] }
    expect(personalProject(me)).toBeUndefined()
    expect(activeProjects(me).map(({ project }) => project.id)).toEqual([
      'team',
    ])
  })
})

describe('findProject', () => {
  const me: Me = {
    workspaces: [
      workspace('personal', [project('a', { name: 'API' })]),
      workspace('standard', [
        project('b', { name: 'Shared' }),
        project('c', { name: 'shared' }),
      ]),
    ],
  }

  test.each(['a', 'prj_a', 'slug-a', 'api'])('finds %j', (ref: string) => {
    expect(findProject(me, ref).project.id).toBe('a')
  })

  test('rejects an ambiguous name', () => {
    expect(() => findProject(me, 'Shared')).toThrow(
      'More than one project is named "Shared": prj_b (standard workspace), prj_c (standard workspace)'
    )
  })

  test('rejects an unknown project', () => {
    expect(() => findProject(me, 'nope')).toThrow('Project "nope" not found')
  })
})

describe('pickProject', () => {
  test('fails without active projects', async () => {
    const me: Me = {
      workspaces: [
        workspace('standard', [project('p', { status: 'provisioning' })]),
      ],
    }
    await expect(pickProject(me, { message: 'Pick' })).rejects.toThrow(
      "You don't have any active projects"
    )
  })

  test('returns the first active project without a terminal', async () => {
    // vitest's stdin is not a terminal.
    const me: Me = {
      workspaces: [
        workspace('standard', [project('first'), project('second')]),
      ],
    }
    expect((await pickProject(me, { message: 'Pick' })).project.id).toBe(
      'first'
    )
  })
})

describe('fetchMe', () => {
  test('returns undefined for a user workspace-api does not know (401)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 }))
    )
    expect(await fetchMe('token')).toBeUndefined()
  })

  test('sends the access token and validates the response', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ workspaces: [{ id: 'missing-fields' }] })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchMe('token')).rejects.toThrow('Unexpected response')
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token')
  })
})

describe('blockedWarning', () => {
  test('names the block reasons', () => {
    const entry = {
      project: project('p', {
        blocked: true,
        block_reasons: ['credit_exhausted'],
      }),
      workspace: workspace('standard', []),
    }
    expect(blockedWarning(entry)).toContain(
      'Project Project p is blocked (credit_exhausted)'
    )
    expect(blockedWarning({ ...entry, project: project('ok') })).toBeUndefined()
  })
})
