import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApiKey, deleteApiKey, listProjects } from 'src/projects'
import { savedProjectDomain, UserConfigV3 } from 'src/user'

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  for (const name of ['E2B_API_URL', 'E2B_DOMAIN', 'E2B_WORKSPACE_API_URL']) {
    vi.stubEnv(name, '')
    delete process.env[name]
  }
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('listProjects', () => {
  const project = (id: string, domain: string, status = 'active') => ({
    id,
    name: id,
    status,
    control_plane_domain: domain,
  })

  it('lists active projects, the personal one as default', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        workspaces: [
          {
            kind: 'standard',
            projects: [
              project('tango', 'e2b-tango.dev'),
              project('provisioning', 'e2b-tango.dev', 'provisioning'),
            ],
          },
          { kind: 'personal', projects: [project('own', 'e2b-foxtrot.dev')] },
        ],
      })
    )

    const projects = await listProjects('access-token')

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://workspace-api.e2b.dev/v1/me')
    expect(init?.headers).toEqual({ Authorization: 'Bearer access-token' })
    expect(projects).toEqual([
      { id: 'tango', name: 'tango', domain: 'e2b-tango.dev', isDefault: false },
      { id: 'own', name: 'own', domain: 'e2b-foxtrot.dev', isDefault: true },
    ])
  })

  it('defaults to the first project without a personal workspace', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        workspaces: [
          { kind: 'standard', projects: [project('a', 'e2b-tango.dev')] },
          { kind: 'standard', projects: [project('b', 'e2b-juliett.dev')] },
        ],
      })
    )

    const projects = await listProjects('access-token')

    expect(projects.map((p) => p.isDefault)).toEqual([true, false])
  })

  it.each([
    ['e2b-tango.dev', ['tango']],
    ['e2b.app', ['tango', 'juliett']],
  ])(
    'with E2B_DOMAIN=%s offers %j',
    async (domain: string, expected: string[]) => {
      vi.stubEnv('E2B_DOMAIN', domain)
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          workspaces: [
            {
              kind: 'standard',
              projects: [
                project('tango', 'e2b-tango.dev'),
                project('juliett', 'e2b-juliett.dev'),
              ],
            },
          ],
        })
      )

      const projects = await listProjects('access-token')

      expect(projects.map((p) => p.id)).toEqual(expected)
    }
  )

  it('uses E2B_WORKSPACE_API_URL when set', async () => {
    vi.stubEnv('E2B_WORKSPACE_API_URL', 'http://localhost:3020/')
    fetchMock.mockResolvedValue(jsonResponse(200, { workspaces: [] }))

    await listProjects('access-token')

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3020/v1/me'
    )
  })
})

describe('createApiKey', () => {
  const project = {
    id: 'team-tango',
    name: 'Tango',
    domain: 'e2b-tango.dev',
    isDefault: true,
  }

  it("creates the key on the project's control plane", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(201, { id: 'key-id', key: 'e2b_created' })
    )

    const apiKey = await createApiKey('access-token', project)

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.e2b-tango.dev/api-keys')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'X-Team-ID': 'team-tango',
    })
    expect(apiKey).toEqual({ id: 'key-id', key: 'e2b_created' })
  })

  it('creates the key on E2B_API_URL when set, like every command', async () => {
    vi.stubEnv('E2B_API_URL', 'http://localhost:3000/')
    fetchMock.mockResolvedValue(
      jsonResponse(201, { id: 'key-id', key: 'e2b_created' })
    )

    await createApiKey('access-token', project)

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api-keys'
    )
  })
})

describe('deleteApiKey', () => {
  const config = {
    version: 3,
    projectId: 'team-tango',
    project_api_key_id: 'key-id',
    project_domain: 'e2b-tango.dev',
  } as UserConfigV3

  it('deletes the saved key on its control plane', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await deleteApiKey('access-token', config)

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.e2b-tango.dev/api-keys/key-id')
    expect(init?.method).toBe('DELETE')
    expect(init?.headers).toMatchObject({ 'X-Team-ID': 'team-tango' })
  })

  it.each([
    [404, false],
    [403, true],
  ])('on %d warns: %s', async (status: number, warns: boolean) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchMock.mockResolvedValue(jsonResponse(status, { message: 'no' }))

    await expect(deleteApiKey('access-token', config)).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledTimes(warns ? 1 : 0)
  })
})

describe('savedProjectDomain', () => {
  const config = { version: 3, project_domain: 'e2b-tango.dev' } as UserConfigV3

  it("uses the saved project's domain when nothing else picks a host", () => {
    expect(savedProjectDomain(config, {})).toBe('e2b-tango.dev')
  })

  it.each(['E2B_API_KEY', 'E2B_DOMAIN', 'E2B_API_URL'])(
    'leaves the host to %s',
    (name: string) => {
      expect(savedProjectDomain(config, { [name]: 'set' })).toBeUndefined()
    }
  )

  it('has no domain for a version 2 config', () => {
    expect(
      savedProjectDomain({ version: 2 } as unknown as UserConfigV3, {})
    ).toBeUndefined()
  })
})
