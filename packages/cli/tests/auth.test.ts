import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Point USER_CONFIG_PATH (computed from os.homedir() at module load) at a
// temp directory. Modules are imported dynamically after mockHome is set.
let mockHome = ''

vi.mock('os', async (importOriginal: () => Promise<typeof import('os')>) => {
  const actual = await importOriginal()
  return { ...actual, homedir: () => mockHome }
})

/** An unsigned JWT that expires `expiresInSeconds` from now. */
function jwt(expiresInSeconds: number, id = 'token') {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      jti: id,
    })
  ).toString('base64url')
  return `header.${payload}.signature`
}

function configPath() {
  return path.join(mockHome, '.e2b', 'config.json')
}

function writeConfig(
  accessToken: string,
  refreshToken = 'refresh-1',
  extra: Record<string, unknown> = { projectDomain: 'config.e2b.dev' }
) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true })
  fs.writeFileSync(
    configPath(),
    JSON.stringify({
      version: 2,
      identity: { email: 'user@example.com' },
      oauth: {
        token_endpoint: 'https://auth.example.com/oauth2/token',
        revoke_endpoint: 'https://auth.example.com/oauth2/revoke',
        client_id: 'cli',
      },
      tokens: { access_token: accessToken, refresh_token: refreshToken },
      projectName: 'default',
      projectId: 'config-project',
      futureField: 'kept',
      ...extra,
    })
  )
}

function project(id: string, overrides: Record<string, unknown> = {}) {
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

/** workspace-api `GET /v1/me` listing the given projects. */
function mockWorkspaceApi(
  projects = [project('config-project'), project('other')]
) {
  const fetchMock = vi.fn(async (url: string) => {
    expect(url).toBe('https://workspace-api.e2b.dev/v1/me')
    return Response.json({
      workspaces: [
        {
          id: 'ws',
          public_id: 'wrk_ws',
          name: 'Workspace',
          kind: 'personal',
          blocked: false,
          block_reasons: [],
          capabilities: [],
          projects,
        },
      ],
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath(), 'utf8'))
}

/** Token endpoint that rotates refresh tokens, like the real one. */
function mockTokenEndpoint() {
  let issued = 0
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = new URLSearchParams(init.body as string)
    if (body.get('refresh_token') !== `refresh-${issued + 1}`) {
      return Response.json({ error: 'invalid_grant' }, { status: 400 })
    }
    issued += 1
    // Let concurrent callers pile up on the lock while this one refreshes.
    await new Promise((resolve) => setTimeout(resolve, 50))
    return Response.json({
      access_token: jwt(3600, `access-${issued + 1}`),
      refresh_token: `refresh-${issued + 1}`,
      expires_in: 3600,
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv('E2B_API_KEY', '')
  vi.stubEnv('E2B_PROJECT_ID', '')
  vi.stubEnv('E2B_TEAM_ID', '')
  mockHome = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-auth-'))
})

afterEach(() => {
  fs.rmSync(mockHome, { recursive: true, force: true })
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('ensureAuth', () => {
  test('uses E2B_API_KEY when set', async () => {
    vi.stubEnv('E2B_API_KEY', 'e2b_env_key')
    writeConfig(jwt(3600))
    const { ensureAuth } = await import('../src/api')

    expect(await ensureAuth()).toEqual({ apiKey: 'e2b_env_key' })
  })

  test('uses the access token and the configured project otherwise', async () => {
    const token = jwt(3600)
    writeConfig(token)
    const fetchMock = mockWorkspaceApi()
    const { ensureAuth } = await import('../src/api')

    expect(await ensureAuth()).toEqual({
      apiHeaders: {
        Authorization: `Bearer ${token}`,
        'X-Team-ID': 'config-project',
      },
      domain: 'config.e2b.dev',
    })
    // The stored project needs no lookup.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('looks up and stores the domain of a project selected by an earlier version', async () => {
    writeConfig(jwt(3600), 'refresh-1', {})
    const fetchMock = mockWorkspaceApi()
    const { ensureAuth } = await import('../src/api')

    expect(await ensureAuth()).toMatchObject({
      domain: 'config-project.e2b.dev',
    })
    expect(readConfig().projectDomain).toBe('config-project.e2b.dev')
    await ensureAuth()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('sets up the account in workspace-api when /v1/me does not know the user yet', async () => {
    writeConfig(jwt(3600), 'refresh-1', {})
    const calls: string[] = []
    let bootstrapped = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push(`${init.method} ${new URL(url).pathname}`)
        if (url.endsWith('/v1/users/bootstrap')) {
          bootstrapped = true
          return Response.json({})
        }
        if (!bootstrapped) return new Response(null, { status: 401 })
        return Response.json({
          workspaces: [
            {
              id: 'ws',
              public_id: 'wrk_ws',
              name: 'Workspace',
              kind: 'personal',
              blocked: false,
              block_reasons: [],
              capabilities: [],
              projects: [project('config-project')],
            },
          ],
        })
      })
    )
    const { ensureAuth } = await import('../src/api')

    expect(await ensureAuth()).toMatchObject({
      domain: 'config-project.e2b.dev',
    })
    expect(calls).toEqual([
      'GET /v1/me',
      'POST /v1/users/bootstrap',
      'GET /v1/me',
    ])
  })

  test('resolves --project, then E2B_PROJECT_ID, to the project ID and its control plane', async () => {
    writeConfig(jwt(3600))
    vi.stubEnv('E2B_PROJECT_ID', 'prj_other')
    const fetchMock = mockWorkspaceApi([
      project('config-project'),
      project('other'),
      project('flag'),
    ])
    const { ensureAuth, setProjectOverride } = await import('../src/api')

    // `--project` reaches ensureAuth() through setProjectOverride().
    const target = async (ref?: string) => {
      setProjectOverride(ref)
      const auth = (await ensureAuth()) as {
        apiHeaders: Record<string, string>
        domain: string
      }
      return [auth.apiHeaders['X-Team-ID'], auth.domain]
    }
    expect(await target()).toEqual(['other', 'other.e2b.dev'])
    expect(await target('slug-flag')).toEqual(['flag', 'flag.e2b.dev'])
    expect(await target('project FLAG')).toEqual(['flag', 'flag.e2b.dev'])
    // /v1/me is fetched once per process.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('exits with a hint when the project is not accessible', async () => {
    writeConfig(jwt(3600))
    mockWorkspaceApi()
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`)
    }) as never)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { ensureAuth, setProjectOverride } = await import('../src/api')

    setProjectOverride('prj_missing')
    await expect(ensureAuth()).rejects.toThrow('exit 1')
    expect(String(error.mock.calls[0][0])).toContain(
      'Project "prj_missing" not found'
    )
  })

  test('warns that --project is ignored with E2B_API_KEY', async () => {
    vi.stubEnv('E2B_API_KEY', 'e2b_env_key')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ensureAuth, setProjectOverride } = await import('../src/api')

    setProjectOverride('prj_other')
    expect(await ensureAuth()).toEqual({ apiKey: 'e2b_env_key' })
    await ensureAuth()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('--project')
  })

  test('exits with the login hint when signed out', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number
    ) => {
      throw new Error(`exit ${code}`)
    }) as never)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { ensureAuth } = await import('../src/api')

    await expect(ensureAuth()).rejects.toThrow('exit 1')
    expect(exit).toHaveBeenCalledWith(1)
    expect(String(error.mock.calls[0][0])).toContain('e2b auth login')
  })
})

describe('ensureValidAccessToken', () => {
  test('refreshes an expiring token and stores the rotated tokens', async () => {
    writeConfig(jwt(30))
    const fetchMock = mockTokenEndpoint()
    const { ensureValidAccessToken } =
      await import('../src/utils/token-refresh')

    const { accessToken } = await ensureValidAccessToken()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const stored = readConfig()
    expect(stored.tokens).toEqual({
      access_token: accessToken,
      refresh_token: 'refresh-2',
    })
    // Fields this version doesn't know about survive the write.
    expect(stored.futureField).toBe('kept')
    expect(fs.existsSync(`${configPath()}.lock`)).toBe(false)
  })

  test('refreshes once when several commands need a token at the same time', async () => {
    writeConfig(jwt(-10))
    const fetchMock = mockTokenEndpoint()
    const { ensureValidAccessToken } =
      await import('../src/utils/token-refresh')

    const results = await Promise.all(
      Array.from({ length: 5 }, () => ensureValidAccessToken())
    )

    // Without the lock, the losers would spend the rotated refresh token,
    // get invalid_grant and sign the user out.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new Set(results.map((r) => r.accessToken)).size).toBe(1)
    expect(readConfig().tokens.refresh_token).toBe('refresh-2')
  })

  test('signs out when the refresh token is rejected', async () => {
    writeConfig(jwt(-10), 'revoked')
    mockTokenEndpoint()
    const { ensureValidAccessToken } =
      await import('../src/utils/token-refresh')

    await expect(ensureValidAccessToken()).rejects.toThrow(
      'Your session has expired'
    )
    expect(fs.existsSync(configPath())).toBe(false)
  })

  test('clears a lock left behind by a crashed process', async () => {
    writeConfig(jwt(-10))
    const lockPath = `${configPath()}.lock`
    fs.mkdirSync(lockPath)
    const old = new Date(Date.now() - 60_000)
    fs.utimesSync(lockPath, old, old)
    const fetchMock = mockTokenEndpoint()
    const { ensureValidAccessToken } =
      await import('../src/utils/token-refresh')

    await ensureValidAccessToken()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fs.existsSync(lockPath)).toBe(false)
  })
})

describe('CLI_AUTH_URL', () => {
  test('defaults to e2b.dev/auth/cli', async () => {
    vi.stubEnv('E2B_DOMAIN', '')
    const { CLI_AUTH_URL } = await import('../src/user')
    expect(CLI_AUTH_URL).toBe('https://e2b.dev/auth/cli')
  })

  test('follows E2B_DOMAIN', async () => {
    vi.stubEnv('E2B_DOMAIN', 'e2b.example.com')
    const { CLI_AUTH_URL } = await import('../src/user')
    expect(CLI_AUTH_URL).toBe('https://e2b.example.com/auth/cli')
  })
})
