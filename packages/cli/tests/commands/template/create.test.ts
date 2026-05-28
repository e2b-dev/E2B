import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const apiKey = process.env.E2B_API_KEY
const domain = process.env.E2B_DOMAIN || 'e2b.app'
const testIf = test.skipIf(!apiKey)

const cliPath = path.join(process.cwd(), 'dist', 'index.js')
const templateName = `cli-create-api-key-test-${Date.now()}`

describe('template create cli backend integration', () => {
  let testDir: string

  beforeAll(async () => {
    if (!apiKey) return
    testDir = await fs.mkdtemp('e2b-create-test-')
    await fs.writeFile(
      path.join(testDir, 'e2b.Dockerfile'),
      'FROM ubuntu:latest\n'
    )
  })

  afterAll(async () => {
    if (!testDir) return
    runCli(['template', 'delete', '--yes', templateName])
    await fs.rm(testDir, { recursive: true, force: true })
  })

  testIf(
    'template create succeeds with E2B_API_KEY alone (no E2B_ACCESS_TOKEN)',
    { timeout: 300_000 },
    () => {
      const result = runCli([
        'template',
        'create',
        templateName,
        '--path',
        testDir,
      ])
      const output = String(result.stdout || '') + String(result.stderr || '')

      expect(result.status, output).toBe(0)
      // Success marker printed by create.ts on a finished build; the failure
      // path prints "❌ Template build failed." instead.
      expect(output).toContain('✅ Building sandbox template')
      expect(output).not.toContain('❌ Template build failed')
      // Auth never fell through to the access-token error box.
      expect(output).not.toMatch(/You must be logged in/)
    }
  )
})

function runCli(args: string[]): ReturnType<typeof spawnSync> {
  // Intentionally exclude E2B_ACCESS_TOKEN from the child env so this test
  // verifies the API-key-only auth path end-to-end.
  return spawnSync('node', [cliPath, ...args], {
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      E2B_DOMAIN: domain,
      E2B_API_KEY: apiKey,
    },
    encoding: 'utf8',
    timeout: 300_000,
  })
}
