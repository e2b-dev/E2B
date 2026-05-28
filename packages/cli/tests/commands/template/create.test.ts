import { spawnSync } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

// A syntactically valid E2B API key (mirrors the SDK's validation regex
// `^e2b_[0-9a-f]+$`). The key is bogus — these tests never reach the API.
const VALID_FORMAT_API_KEY = `e2b_${'0'.repeat(40)}`

const cliPath = path.join(process.cwd(), 'dist', 'index.js')

function runCreate({
  testDir,
  homeDir,
  templateName,
  env,
  extraArgs = [],
  timeoutMs = 8000,
}: {
  testDir: string
  homeDir: string
  templateName: string
  env: NodeJS.ProcessEnv
  extraArgs?: string[]
  timeoutMs?: number
}) {
  const result = spawnSync(
    'node',
    [
      cliPath,
      'template',
      'create',
      templateName,
      '--path',
      testDir,
      ...extraArgs,
    ],
    {
      encoding: 'utf-8',
      timeout: timeoutMs,
      env: {
        PATH: process.env.PATH,
        HOME: homeDir,
        // Force domain to one that fails DNS quickly so the API call doesn't
        // hang past our timeout once credential checks pass.
        E2B_DOMAIN: 'invalid.e2b-cli-test.localhost',
        ...env,
      },
    }
  )
  return {
    status: result.status,
    output: (result.stdout || '') + (result.stderr || ''),
  }
}

describe('Template Create', () => {
  let testDir: string
  let homeDir: string

  beforeEach(async () => {
    testDir = await fs.mkdtemp('e2b-create-test-')
    homeDir = await fs.mkdtemp('e2b-create-home-')
    await fs.writeFile(
      path.join(testDir, 'e2b.Dockerfile'),
      'FROM alpine:3.18\n'
    )
  })

  afterEach(async () => {
    if (testDir) await fs.rm(testDir, { recursive: true, force: true })
    if (homeDir) await fs.rm(homeDir, { recursive: true, force: true })
  })

  test('accepts E2B_API_KEY alone (no E2B_ACCESS_TOKEN required)', () => {
    const { output } = runCreate({
      testDir,
      homeDir,
      templateName: 'my-template',
      env: { E2B_API_KEY: VALID_FORMAT_API_KEY },
    })

    // Reaching "Building sandbox template..." means we passed every
    // pre-build credential check without an access token.
    expect(output).toContain('Building sandbox template...')
    // And we never printed the access-token auth-error box.
    expect(output).not.toMatch(/You must be logged in/)
    expect(output).not.toContain('E2B_ACCESS_TOKEN')
  })

  test('errors with E2B_API_KEY message when no credentials are present', () => {
    const { status, output } = runCreate({
      testDir,
      homeDir,
      templateName: 'my-template',
      env: {},
    })

    expect(status).not.toBe(0)
    expect(output).toContain('You must be logged in')
    expect(output).toContain('E2B_API_KEY')
    // Create's API calls only accept API keys, so the access-token env var
    // should never be advertised as a remedy here.
    expect(output).not.toContain('E2B_ACCESS_TOKEN')
  })

  test('rejects invalid template names before any credential check', () => {
    const { status, output } = runCreate({
      testDir,
      homeDir,
      templateName: 'Invalid-Name',
      env: {},
    })

    expect(status).not.toBe(0)
    expect(output).toContain('is not valid')
    // Name validation runs before ensureAPIKey, so we should not see the
    // auth-error box for invalid names.
    expect(output).not.toContain('You must be logged in')
  })

  test('rejects odd memory values', () => {
    const { status, output } = runCreate({
      testDir,
      homeDir,
      templateName: 'my-template',
      env: { E2B_API_KEY: VALID_FORMAT_API_KEY },
      extraArgs: ['--memory-mb', '513'],
    })

    expect(status).not.toBe(0)
    expect(output).toContain('memory in megabytes must be an even number')
  })
})
