import { spawnSync } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

// A syntactically valid E2B API key (mirrors the SDK's validation regex
// `^e2b_[0-9a-f]+$`). The key is bogus — this test never reaches the API.
const VALID_FORMAT_API_KEY = `e2b_${'0'.repeat(40)}`

const cliPath = path.join(process.cwd(), 'dist', 'index.js')

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
    const result = spawnSync(
      'node',
      [cliPath, 'template', 'create', 'my-template', '--path', testDir],
      {
        encoding: 'utf-8',
        timeout: 8000,
        env: {
          PATH: process.env.PATH,
          // Isolated HOME so ~/.e2b/config.json cannot leak an access token in.
          HOME: homeDir,
          E2B_API_KEY: VALID_FORMAT_API_KEY,
          // Force domain to one that fails DNS quickly so the API call doesn't
          // hang past our timeout once credential checks pass.
          E2B_DOMAIN: 'invalid.e2b-cli-test.localhost',
        },
      }
    )
    const output = (result.stdout || '') + (result.stderr || '')

    // Reaching "Building sandbox template..." means we passed every pre-build
    // credential check without an access token.
    expect(output).toContain('Building sandbox template...')
    // And we never printed the access-token auth-error box.
    expect(output).not.toMatch(/You must be logged in/)
    expect(output).not.toContain('E2B_ACCESS_TOKEN')
  })
})
