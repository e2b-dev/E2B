import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { Me, Project } from '../../src/workspaces'

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    public_id: `prj_${id}`,
    workspace_id: 'ws',
    name: `Project ${id}`,
    slug: `slug-${id}`,
    region: 'us-west-1',
    control_plane_domain: `${id}.e2b.dev`,
    status: 'active',
    blocked: false,
    block_reasons: [],
    capabilities: ['project:read'],
    ...overrides,
  }
}

const me: Me = {
  workspaces: [
    {
      id: 'personal',
      public_id: 'wrk_personal',
      name: 'Personal',
      kind: 'personal',
      blocked: false,
      block_reasons: [],
      capabilities: [],
      projects: [project('mine')],
    },
    {
      id: 'team',
      public_id: 'wrk_team',
      name: 'Team',
      kind: 'standard',
      blocked: false,
      block_reasons: [],
      capabilities: [],
      projects: [
        project('shared', {
          blocked: true,
          block_reasons: ['credit_exhausted'],
        }),
        project('new', { status: 'provisioning' }),
      ],
    },
  ],
}

const mocks = vi.hoisted(() => ({
  updateUserConfig: vi.fn(),
  current: undefined as string | undefined,
  select: vi.fn(),
}))

vi.mock('@inquirer/prompts', () => ({ select: mocks.select }))

vi.mock(
  '../../src/api',
  async (importOriginal: () => Promise<typeof import('../../src/api')>) => ({
    ...(await importOriginal()),
    requireMe: async () => me,
    currentProject: () => mocks.current,
  })
)

vi.mock(
  '../../src/utils/token-refresh',
  async (
    importOriginal: () => Promise<
      typeof import('../../src/utils/token-refresh')
    >
  ) => ({
    ...(await importOriginal()),
    updateUserConfig: mocks.updateUserConfig,
  })
)

async function run(args: string[]) {
  const out: string[] = []
  const err: string[] = []
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) =>
    out.push(a.join(' '))
  )
  vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) =>
    err.push(a.join(' '))
  )
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) =>
    err.push(a.join(' '))
  )
  const exit = vi.spyOn(process, 'exit').mockImplementation(((
    code?: number
  ) => {
    throw new Error(`exit ${code}`)
  }) as never)

  const { program } = await import('../../src/commands')
  await program
    .parseAsync(args, { from: 'user' })
    .catch((e: Error) => err.push(e.message))
  return { out: out.join('\n'), err: err.join('\n'), exit }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.current = 'mine'
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('e2b workspace list', () => {
  test('lists workspaces with their project count', async () => {
    const { out } = await run(['workspace', 'list', '--format', 'json'])
    expect(JSON.parse(out)).toEqual([
      expect.objectContaining({ public_id: 'wrk_personal', project_count: 1 }),
      expect.objectContaining({ public_id: 'wrk_team', project_count: 2 }),
    ])
  })
})

describe('e2b project list', () => {
  test('marks the current project and shows blocked ones', async () => {
    const { out } = await run(['project', 'list'])
    expect(out).toMatch(/\*\s+prj_mine/)
    expect(out).toContain('blocked (credit_exhausted)')
    expect(out).toContain('provisioning')
  })

  test('filters by --workspace', async () => {
    const { out } = await run(['project', 'list', '-w', 'team', '-f', 'json'])
    expect(JSON.parse(out).map((p: Project) => p.public_id)).toEqual([
      'prj_shared',
      'prj_new',
    ])
  })

  test('rejects an unknown workspace', async () => {
    const { err } = await run(['project', 'list', '--workspace', 'nope'])
    expect(err).toContain('Workspace "nope" not found')
  })

  test('rejects an ambiguous workspace name', async () => {
    me.workspaces.push({ ...me.workspaces[1], id: 'team2', public_id: 'wrk_team2', projects: [] })
    try {
      const { err } = await run(['project', 'list', '--workspace', 'TEAM'])
      expect(err).toContain('More than one workspace is named "TEAM"')
      expect(err).toContain('wrk_team, wrk_team2')
    } finally {
      me.workspaces.pop()
    }
  })
})

describe('e2b project use', () => {
  test('stores the project, its name and control plane', async () => {
    const { out } = await run(['project', 'use', 'slug-shared'])
    expect(mocks.updateUserConfig).toHaveBeenCalledWith({
      projectId: 'shared',
      projectName: 'Project shared',
      projectDomain: 'shared.e2b.dev',
    })
    expect(out).toContain('Now using project')
  })

  test('warns about a blocked project', async () => {
    const { err } = await run(['project', 'use', 'prj_shared'])
    expect(err).toContain('is blocked (credit_exhausted)')
  })

  test('refuses a project that is not active', async () => {
    const { err } = await run(['project', 'use', 'prj_new'])
    expect(err).toContain("is provisioning and can't be used")
    expect(mocks.updateUserConfig).not.toHaveBeenCalled()
  })

  test('looks a name up in --workspace only', async () => {
    const { err } = await run([
      'project',
      'use',
      'Project mine',
      '--workspace',
      'Team',
    ])
    expect(err).toContain('not found among the projects you can access in workspace Team')
    expect(mocks.updateUserConfig).not.toHaveBeenCalled()
  })

  describe('without a project', () => {
    afterEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        configurable: true,
      })
    })

    test('asks for the workspace, then the project', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      })
      type Prompt = { message: string; choices: { value: unknown }[] }
      // Team has one active project, so only the workspace is asked for.
      mocks.select.mockImplementationOnce(
        async (p: Prompt) => p.choices[1].value
      )

      const { out } = await run(['project', 'use'])

      expect(
        mocks.select.mock.calls.map(([p]: [Prompt]) => p.message)
      ).toEqual(['Select workspace'])
      expect(mocks.updateUserConfig).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'shared' })
      )
      expect(out).toContain('in workspace Team')
    })

    test('only offers --workspace', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      })
      // Team has one active project, so nothing is asked.
      const { out } = await run(['project', 'use', '--workspace', 'wrk_team'])
      expect(mocks.select).not.toHaveBeenCalled()
      expect(out).toContain('Now using project Project shared')
    })

    test('needs a terminal', async () => {
      const { err } = await run(['project', 'use'])
      expect(err).toContain('Pass the project to use')
      expect(mocks.updateUserConfig).not.toHaveBeenCalled()
    })
  })
})

describe('e2b project info', () => {
  test('shows the current project', async () => {
    mocks.current = 'prj_shared'
    const { out } = await run(['project', 'info', '-f', 'json'])
    expect(JSON.parse(out)).toMatchObject({
      id: 'shared',
      control_plane_domain: 'shared.e2b.dev',
      workspace_name: 'Team',
    })
  })

  test('fails when no project is selected', async () => {
    mocks.current = undefined
    const { err } = await run(['project', 'info'])
    expect(err).toContain('No project selected')
  })
})
