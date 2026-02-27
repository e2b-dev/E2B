import { assert, test, beforeEach, afterEach, vi, describe } from 'vitest'
import { ConnectionConfig } from '../src/connectionConfig'
import * as cliConfigModule from '../src/cliConfig'

// Store original env vars to restore after tests
let originalEnv: { [key: string]: string | undefined }

beforeEach(() => {
  originalEnv = {
    E2B_API_URL: process.env.E2B_API_URL,
    E2B_DOMAIN: process.env.E2B_DOMAIN,
    E2B_DEBUG: process.env.E2B_DEBUG,
    E2B_API_KEY: process.env.E2B_API_KEY,
    E2B_ACCESS_TOKEN: process.env.E2B_ACCESS_TOKEN,
  }
  // Clear CLI config cache before each test
  cliConfigModule.clearCLIConfigCache()
})

afterEach(() => {
  // Restore original env vars
  Object.keys(originalEnv).forEach((key) => {
    if (originalEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalEnv[key]
    }
  })
  // Restore all mocks
  vi.restoreAllMocks()
})

test('api_url defaults correctly', () => {
  // Ensure no env vars interfere
  delete process.env.E2B_API_URL
  delete process.env.E2B_DOMAIN
  delete process.env.E2B_DEBUG

  const config = new ConnectionConfig()
  assert.equal(config.apiUrl, 'https://api.e2b.app')
})

test('api_url in args', () => {
  const config = new ConnectionConfig({ apiUrl: 'http://localhost:8080' })
  assert.equal(config.apiUrl, 'http://localhost:8080')
})

test('api_url in env var', () => {
  process.env.E2B_API_URL = 'http://localhost:8080'

  const config = new ConnectionConfig()
  assert.equal(config.apiUrl, 'http://localhost:8080')
})

test('api_url has correct priority', () => {
  process.env.E2B_API_URL = 'http://localhost:1111'

  const config = new ConnectionConfig({ apiUrl: 'http://localhost:8080' })
  assert.equal(config.apiUrl, 'http://localhost:8080')
})

describe('CLI credentials', () => {
  test('apiKey from CLI config when no env var', () => {
    delete process.env.E2B_API_KEY

    vi.spyOn(cliConfigModule, 'getCLIConfig').mockReturnValue({
      teamApiKey: 'cli-api-key',
      accessToken: 'cli-access-token',
    })

    const config = new ConnectionConfig()
    assert.equal(config.apiKey, 'cli-api-key')
  })

  test('accessToken from CLI config when no env var', () => {
    delete process.env.E2B_ACCESS_TOKEN

    vi.spyOn(cliConfigModule, 'getCLIConfig').mockReturnValue({
      teamApiKey: 'cli-api-key',
      accessToken: 'cli-access-token',
    })

    const config = new ConnectionConfig()
    assert.equal(config.accessToken, 'cli-access-token')
  })

  test('env var takes priority over CLI config for apiKey', () => {
    process.env.E2B_API_KEY = 'env-api-key'

    vi.spyOn(cliConfigModule, 'getCLIConfig').mockReturnValue({
      teamApiKey: 'cli-api-key',
      accessToken: 'cli-access-token',
    })

    const config = new ConnectionConfig()
    assert.equal(config.apiKey, 'env-api-key')
  })

  test('env var takes priority over CLI config for accessToken', () => {
    process.env.E2B_ACCESS_TOKEN = 'env-access-token'

    vi.spyOn(cliConfigModule, 'getCLIConfig').mockReturnValue({
      teamApiKey: 'cli-api-key',
      accessToken: 'cli-access-token',
    })

    const config = new ConnectionConfig()
    assert.equal(config.accessToken, 'env-access-token')
  })

  test('constructor param takes priority over env var and CLI config for apiKey', () => {
    process.env.E2B_API_KEY = 'env-api-key'

    vi.spyOn(cliConfigModule, 'getCLIConfig').mockReturnValue({
      teamApiKey: 'cli-api-key',
      accessToken: 'cli-access-token',
    })

    const config = new ConnectionConfig({ apiKey: 'direct-api-key' })
    assert.equal(config.apiKey, 'direct-api-key')
  })

  test('constructor param takes priority over env var and CLI config for accessToken', () => {
    process.env.E2B_ACCESS_TOKEN = 'env-access-token'

    vi.spyOn(cliConfigModule, 'getCLIConfig').mockReturnValue({
      teamApiKey: 'cli-api-key',
      accessToken: 'cli-access-token',
    })

    const config = new ConnectionConfig({ accessToken: 'direct-access-token' })
    assert.equal(config.accessToken, 'direct-access-token')
  })

  test('returns undefined when no credentials available', () => {
    delete process.env.E2B_API_KEY
    delete process.env.E2B_ACCESS_TOKEN

    vi.spyOn(cliConfigModule, 'getCLIConfig').mockReturnValue(null)

    const config = new ConnectionConfig()
    assert.equal(config.apiKey, undefined)
    assert.equal(config.accessToken, undefined)
  })
})
