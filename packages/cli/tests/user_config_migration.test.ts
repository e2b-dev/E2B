import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Point USER_CONFIG_PATH (computed from os.homedir() at module load) at a
// temp directory. src/user is imported dynamically after mockHome is set.
let mockHome = ''

vi.mock('os', async (importOriginal: () => Promise<typeof import('os')>) => {
  const actual = await importOriginal()
  return {
    ...actual,
    homedir: () => mockHome,
  }
})

const v1AuthFields = {
  identity: {
    email: 'user@example.com',
  },
  oauth: {
    token_endpoint: 'https://hydra.example.com/oauth2/token',
    revoke_endpoint: 'https://hydra.example.com/oauth2/revoke',
    client_id: 'cli-client-id',
  },
  tokens: {
    access_token: 'access-token-secret',
    refresh_token: 'refresh-token-secret',
  },
  last_refresh: '2024-06-24T12:00:00.000Z',
}

beforeEach(() => {
  vi.resetModules()
  mockHome = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-config-migration-'))
})

afterEach(() => {
  fs.rmSync(mockHome, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function writeConfigFile(config: unknown): string {
  const configPath = path.join(mockHome, '.e2b', 'config.json')
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  return configPath
}

describe('getUserConfig', () => {
  it('migrates a v1 team config to the v2 project format in memory', async () => {
    writeConfigFile({
      version: 1,
      ...v1AuthFields,
      teamName: 'default',
      teamId: 'team-id',
      teamApiKey: 'team-api-key-secret',
      dockerProxySet: true,
    })

    const { getUserConfig } = await import('../src/user')

    expect(getUserConfig()).toEqual({
      version: 2,
      ...v1AuthFields,
      projectName: 'default',
      projectId: 'team-id',
      projectApiKey: 'team-api-key-secret',
      dockerProxySet: true,
    })
  })

  it('returns a valid v2 config as-is', async () => {
    const v2Config = {
      version: 2,
      ...v1AuthFields,
      projectName: 'default',
      projectId: 'project-id',
      projectApiKey: 'project-api-key-secret',
    }
    writeConfigFile(v2Config)

    const { getUserConfig } = await import('../src/user')
    expect(getUserConfig()).toEqual(v2Config)
  })

  it('deletes an unrecognized config and signs the user out', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      /* silence deprecation message */
    })
    const configPath = writeConfigFile({
      version: 1,
      ...v1AuthFields,
      // Missing team* fields — cannot be migrated.
    })

    const { getUserConfig, DEPRECATED_USER_CONFIG_MESSAGE } = await import(
      '../src/user'
    )
    expect(getUserConfig()).toBeNull()
    expect(fs.existsSync(configPath)).toBe(false)
    expect(consoleError).toHaveBeenCalledWith(DEPRECATED_USER_CONFIG_MESSAGE)
  })
})
