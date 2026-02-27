import { assert, test, beforeEach, afterEach, describe } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getCLIConfig, clearCLIConfigCache, CLIConfig } from '../src/cliConfig'

const testConfigPath = path.join(os.homedir(), '.e2b', 'config.json')
const testConfigDir = path.dirname(testConfigPath)

describe('getCLIConfig', () => {
  let originalConfigContent: string | null = null
  let configExisted = false

  beforeEach(() => {
    clearCLIConfigCache()

    if (fs.existsSync(testConfigPath)) {
      configExisted = true
      originalConfigContent = fs.readFileSync(testConfigPath, 'utf8')
    }
  })

  afterEach(() => {
    if (configExisted && originalConfigContent !== null) {
      fs.mkdirSync(testConfigDir, { recursive: true })
      fs.writeFileSync(testConfigPath, originalConfigContent)
    } else if (!configExisted && fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath)
    }
    clearCLIConfigCache()
  })

  test('returns null when config file does not exist', () => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath)
    }
    clearCLIConfigCache()

    const config = getCLIConfig()
    assert.equal(config, null)
  })

  test('returns parsed config when file exists', () => {
    const mockConfig: CLIConfig = {
      email: 'test@example.com',
      accessToken: 'test-access-token',
      teamName: 'test-team',
      teamId: 'team-123',
      teamApiKey: 'test-api-key',
    }

    fs.mkdirSync(testConfigDir, { recursive: true })
    fs.writeFileSync(testConfigPath, JSON.stringify(mockConfig))
    clearCLIConfigCache()

    const config = getCLIConfig()
    assert.deepEqual(config, mockConfig)
  })

  test('returns null when config file contains invalid JSON', () => {
    fs.mkdirSync(testConfigDir, { recursive: true })
    fs.writeFileSync(testConfigPath, 'invalid json')
    clearCLIConfigCache()

    const config = getCLIConfig()
    assert.equal(config, null)
  })

  test('caches the config after first read', () => {
    const mockConfig: CLIConfig = {
      teamApiKey: 'cached-api-key',
    }

    fs.mkdirSync(testConfigDir, { recursive: true })
    fs.writeFileSync(testConfigPath, JSON.stringify(mockConfig))
    clearCLIConfigCache()

    const config1 = getCLIConfig()

    fs.writeFileSync(
      testConfigPath,
      JSON.stringify({ teamApiKey: 'different-key' })
    )

    const config2 = getCLIConfig()

    assert.deepEqual(config1, mockConfig)
    assert.deepEqual(config2, mockConfig)
  })

  test('clearCLIConfigCache allows re-reading config', () => {
    const mockConfig1: CLIConfig = { teamApiKey: 'key1' }
    const mockConfig2: CLIConfig = { teamApiKey: 'key2' }

    fs.mkdirSync(testConfigDir, { recursive: true })
    fs.writeFileSync(testConfigPath, JSON.stringify(mockConfig1))
    clearCLIConfigCache()

    const config1 = getCLIConfig()
    assert.deepEqual(config1, mockConfig1)

    fs.writeFileSync(testConfigPath, JSON.stringify(mockConfig2))
    clearCLIConfigCache()

    const config2 = getCLIConfig()
    assert.deepEqual(config2, mockConfig2)
  })
})
