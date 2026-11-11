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

function writeConfig(accessToken: string, refreshToken = 'refresh-1') {
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
      projectApiKey: 'e2b_stale_key',
    })
  )
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
    const { ensureAuth } = await import('../src/api')

    expect(await ensureAuth()).toEqual({
      apiHeaders: {
        Authorization: `Bearer ${token}`,
        'X-Team-ID': 'config-project',
      },
    })
  })

  test('selects the project from --project, then E2B_PROJECT_ID', async () => {
    writeConfig(jwt(3600))
    vi.stubEnv('E2B_PROJECT_ID', 'env-project')
    const { ensureAuth } = await import('../src/api')

    const headers = async (project?: string) =>
      ((await ensureAuth(project)) as { apiHeaders: Record<string, string> })
        .apiHeaders['X-Team-ID']
    expect(await headers()).toBe('env-project')
    expect(await headers('flag-project')).toBe('flag-project')
  })

  test('exits with the login hint when signed out', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
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
    // The API key earlier versions stored is dropped on write.
    expect(stored.projectApiKey).toBeUndefined()
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
