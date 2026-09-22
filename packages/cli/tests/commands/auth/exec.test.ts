import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

import { bufferToText, runCli } from '../../setup'

const temporaryHomes: string[] = []

afterEach(() => {
  for (const home of temporaryHomes.splice(0)) {
    fs.rmSync(home, { force: true, recursive: true })
  }
})

describe('auth exec', () => {
  test('uses the credential selected by CLI login and forwards arguments', () => {
    const home = createAuthenticatedHome('config-api-key')
    const result = runCli(
      [
        'auth',
        'exec',
        '--',
        process.execPath,
        '-e',
        'process.stdout.write(JSON.stringify({ authenticated: process.env.E2B_API_KEY === "config-api-key", args: process.argv.slice(1) }))',
        'first',
        '--flag',
      ],
      {
        env: {
          ...process.env,
          E2B_API_KEY: undefined,
          HOME: home,
          USERPROFILE: home,
        },
        timeoutMs: 10_000,
      }
    )

    expect(result.status).toBe(0)
    expect(bufferToText(result.stderr)).toBe('')
    expect(JSON.parse(bufferToText(result.stdout))).toEqual({
      authenticated: true,
      args: ['first', '--flag'],
    })
  })

  test('prefers E2B_API_KEY and returns the child exit code', () => {
    const home = createAuthenticatedHome('config-api-key')
    const result = runCli(
      [
        'auth',
        'exec',
        '--',
        process.execPath,
        '-e',
        'process.exit(process.env.E2B_API_KEY === "env-api-key" ? 23 : 24)',
      ],
      {
        env: {
          ...process.env,
          E2B_API_KEY: 'env-api-key',
          HOME: home,
          USERPROFILE: home,
        },
        timeoutMs: 10_000,
      }
    )

    expect(result.status).toBe(23)
    expect(bufferToText(result.stdout)).toBe('')
    expect(bufferToText(result.stderr)).toBe('')
  })
})

function createAuthenticatedHome(apiKey: string): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-auth-exec-'))
  temporaryHomes.push(home)

  const configDirectory = path.join(home, '.e2b')
  fs.mkdirSync(configDirectory)
  fs.writeFileSync(
    path.join(configDirectory, 'config.json'),
    JSON.stringify({
      version: 2,
      identity: { email: 'test@example.com' },
      oauth: {
        token_endpoint: 'https://example.com/token',
        revoke_endpoint: 'https://example.com/revoke',
        client_id: 'test-client',
      },
      tokens: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      },
      last_refresh: '2026-09-22T00:00:00.000Z',
      projectName: 'Test project',
      projectId: 'test-project',
      projectApiKey: apiKey,
    })
  )

  return home
}
