import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, test } from 'vitest'

import { bufferToText, runCli } from '../../setup'

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string) => text.replace(/\x1B\[[0-9;]*m/g, '')

const tmpDirs: string[] = []

afterEach(() => {
  for (const tmpDir of tmpDirs.splice(0)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

function writeConfigInTempHome(config: Record<string, unknown>): string {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-auth-info-test-'))
  tmpDirs.push(homeDir)
  const configDir = path.join(homeDir, '.e2b')
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify(config, null, 2)
  )
  return homeDir
}

function runAuthInfo(homeDir: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
  }
  delete env.E2B_API_KEY
  delete env.E2B_ACCESS_TOKEN
  return runCli(['auth', 'info'], { timeoutMs: 20_000, env })
}

const baseConfig = {
  version: 1,
  identity: {
    email: 'user@example.com',
  },
  oauth: {
    token_endpoint: 'https://hydra.example.com/oauth2/token',
    revoke_endpoint: 'https://hydra.example.com/oauth2/revoke',
    client_id: 'cli-client-id',
  },
  tokens: {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
  },
  last_refresh: '2026-07-22T12:00:00.000Z',
  teamName: 'Acme Project',
  teamId: 'a1b2c3d4',
  teamApiKey: 'e2b_' + '0'.repeat(40),
}

describe('auth info', () => {
  test('prints the selected project name and ID', () => {
    const homeDir = writeConfigInTempHome(baseConfig)
    const result = runAuthInfo(homeDir)

    const output = stripAnsi(bufferToText(result.stdout))
    expect(result.status).toBe(0)
    expect(output).toContain('You are logged in as user@example.com')
    expect(output).toContain('Selected project: Acme Project (a1b2c3d4)')
    expect(output).not.toContain('team')
  })

  test('prints a project-worded fallback when the name is missing', () => {
    const { teamName: _teamName, ...configWithoutName } = baseConfig
    const homeDir = writeConfigInTempHome(configWithoutName)
    const result = runAuthInfo(homeDir)

    const output = stripAnsi(bufferToText(result.stdout))
    expect(result.status).toBe(0)
    expect(output).toContain('Log out and log in to get project name')
    expect(output).not.toContain('team')
  })
})
