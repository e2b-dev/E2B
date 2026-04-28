import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeUserConfig, type UserConfig } from '../src/user'

const tmpDirs: string[] = []

afterEach(() => {
  for (const tmpDir of tmpDirs.splice(0)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe('writeUserConfig', () => {
  it('stores API credentials in an owner-only config file and directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-config-perms-'))
    tmpDirs.push(tmpDir)
    const configPath = path.join(tmpDir, '.e2b', 'config.json')
    const config: UserConfig = {
      email: 'victim@example.com',
      accessToken: 'access-token-secret',
      teamName: 'default',
      teamId: 'team-id',
      teamApiKey: 'team-api-key-secret',
    }

    writeUserConfig(configPath, config)

    expect(fs.statSync(path.dirname(configPath)).mode & 0o777).toBe(0o700)
    expect(fs.statSync(configPath).mode & 0o777).toBe(0o600)
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual(config)
  })
})
