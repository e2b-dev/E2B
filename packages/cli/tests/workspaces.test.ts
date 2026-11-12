import { afterEach, describe, expect, test, vi } from 'vitest'

const prompts = vi.hoisted(() => ({ select: vi.fn() }))
vi.mock('../src/utils/prompts', () => ({ select: prompts.select }))

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
  id: string,
  projects: Project[],
  overrides: Partial<Workspace> = {}
): Workspace {
  return {
    id,
    public_id: `wrk_${id}`,
    name: `${id} workspace`,
    kind: id === 'personal' ? 'personal' : 'standard',
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
      workspace('other', [
        project('d', { slug: 'slug-b' }),
        project('e', { slug: 'shared' }),
      ]),
    ],
  }

  test.each(['a', 'prj_a', 'slug-a', 'api'])('finds %j', (ref: string) => {
    expect(findProject(me, ref).project.id).toBe('a')
  })

  test('rejects an ambiguous name', () => {
    expect(() => findProject(me, 'Shared')).toThrow(
      'More than one project matches "Shared": prj_b (standard workspace), prj_c (standard workspace)'
    )
  })

  test('rejects a slug shared across workspaces', () => {
    expect(() => findProject(me, 'slug-b')).toThrow(
      'More than one project matches "slug-b": prj_b (standard workspace), prj_d (other workspace)'
    )
  })

  test('prefers a slug over names', () => {
    // "shared" is e's slug and, case-insensitively, b's and c's name.
    expect(findProject(me, 'shared').project.id).toBe('e')
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

  test('keeps the selected project without a terminal', async () => {
    const me: Me = {
      workspaces: [
        workspace('standard', [project('first'), project('second')]),
      ],
    }
    expect(
      (await pickProject(me, { message: 'Pick', selectedId: 'second' })).project
        .id
    ).toBe('second')
  })

  describe('with a terminal', () => {
    type Option = { label: string; value: unknown }
    type Prompt = { message: string; options: Option[]; initialValue?: unknown }

    const me: Me = {
      workspaces: [
        workspace('personal', [project('a')]),
        workspace('standard', [
          project('b'),
          project('c'),
          project('d', { status: 'provisioning' }),
        ]),
      ],
    }

    function answer(...picks: ((prompt: Prompt) => unknown)[]) {
      for (const pick of picks) {
        prompts.select.mockImplementationOnce(async (prompt: Prompt) =>
          pick(prompt)
        )
      }
    }
    const asked = () =>
      prompts.select.mock.calls.map(([prompt]: [Prompt]) => ({
        message: prompt.message,
        names: prompt.options.map((o) => o.label),
      }))

    afterEach(() => {
      prompts.select.mockReset()
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        configurable: true,
      })
    })
    const withTTY = () =>
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      })

    test('asks for the workspace, then one of its active projects', async () => {
      withTTY()
      answer(
        (p) => p.options[1].value,
        (p) => p.options[1].value
      )
      const picked = await pickProject(me, { message: 'Pick', selectedId: 'a' })

      expect(picked.project.id).toBe('c')
      expect(asked()).toEqual([
        {
          message: 'Select workspace',
          names: [
            expect.stringContaining('personal workspace'),
            expect.stringContaining('standard workspace'),
          ],
        },
        {
          message: 'Pick',
          names: [
            expect.stringContaining('Project b'),
            expect.stringContaining('Project c'),
          ],
        },
      ])
      expect(asked()[0].names[0]).toContain('(1 active project)')
      expect(asked()[0].names[0]).toContain('current')
      expect(asked()[0].names[1]).toContain('(2 active projects)')
      // The selected project's workspace is preselected.
      expect(prompts.select.mock.calls[0][0].initialValue).toBe(
        me.workspaces[0]
      )
    })

    test('asks even when a step has a single choice', async () => {
      withTTY()
      const single: Me = { workspaces: [me.workspaces[0]] }
      answer(
        (p) => p.options[0].value,
        (p) => p.options[0].value
      )
      expect((await pickProject(single, { message: 'Pick' })).project.id).toBe(
        'a'
      )
      expect(asked()).toEqual([
        { message: 'Select workspace', names: [expect.any(String)] },
        { message: 'Pick', names: [expect.stringContaining('Project a')] },
      ])
    })

    test('only offers the given workspace', async () => {
      withTTY()
      answer((p) => p.options[1].value)
      const picked = await pickProject(me, {
        message: 'Pick',
        workspace: me.workspaces[1],
      })
      expect(picked.project.id).toBe('c')
      expect(asked()).toHaveLength(1)
      expect(asked()[0].message).toBe('Pick')
    })

    test('fails when the given workspace has no active project', async () => {
      withTTY()
      const empty = workspace('empty', [project('x', { status: 'deleting' })])
      await expect(
        pickProject(
          { workspaces: [...me.workspaces, empty] },
          {
            message: 'Pick',
            workspace: empty,
          }
        )
      ).rejects.toThrow('Workspace empty workspace has no active projects')
    })
  })
})

describe('findProject in a workspace', () => {
  const me: Me = {
    workspaces: [
      workspace('one', [project('a', { name: 'Shared' })]),
      workspace('two', [project('b', { name: 'Shared' })]),
    ],
  }

  test('scopes names to the workspace', () => {
    expect(findProject(me, 'shared', me.workspaces[1]).project.id).toBe('b')
  })

  test('does not find projects of other workspaces', () => {
    expect(() => findProject(me, 'prj_a', me.workspaces[1])).toThrow(
      'not found among the projects you can access in workspace two workspace'
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

  test('sends the access token and keeps only the fields the CLI uses', async () => {
    vi.stubEnv('E2B_WORKSPACE_API_URL', 'http://localhost:8080')
    const me: Me = { workspaces: [workspace('personal', [project('a')])] }
    const fetchMock = vi.fn(async (_req: Request) =>
      Response.json({
        workspaces: me.workspaces.map((w) => ({
          ...w,
          has_sso: false,
          projects: w.projects.map((p) => ({ ...p, email: 'a@example.com' })),
        })),
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchMe('token')).toEqual(me)
    const req = fetchMock.mock.calls[0][0]
    expect(req.url).toBe('http://localhost:8080/v1/me')
    expect(req.headers.get('Authorization')).toBe('Bearer token')
  })

  test('throws with the response body on other errors', async () => {
    vi.stubEnv('E2B_WORKSPACE_API_URL', 'http://localhost:8080')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ code: 500, message: 'boom' }, { status: 500 })
      )
    )
    await expect(fetchMe('token')).rejects.toThrow(
      'Failed to list your workspaces (500 from http://localhost:8080): {"code":500,"message":"boom"}'
    )
  })

  test('falls back to the status text without a body', async () => {
    vi.stubEnv('E2B_WORKSPACE_API_URL', 'http://localhost:8080')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, { status: 502, statusText: 'Bad Gateway' })
      )
    )
    await expect(fetchMe('token')).rejects.toThrow(
      'Failed to list your workspaces (502 from http://localhost:8080): Bad Gateway'
    )
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
