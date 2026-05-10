import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeUserConfig, type UserConfig } from '../src/user'

const tmpDirs: string[] = []
const isPosix = process.platform !== 'win32'

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

    // POSIX permission bits (chmod/stat.mode) are not reliably preserved on
    // Windows, where Node reports broad Windows-derived modes regardless of
    // the chmod call. Only assert the 0o700/0o600 masks on POSIX platforms.
    if (isPosix) {
      expect(fs.statSync(path.dirname(configPath)).mode & 0o777).toBe(0o700)
      expect(fs.statSync(configPath).mode & 0o777).toBe(0o600)
    }
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual(config)
  })
})
