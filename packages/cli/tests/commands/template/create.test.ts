import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { getUserConfig } from 'src/user'

type UserConfigWithDomain = NonNullable<ReturnType<typeof getUserConfig>> & {
  domain?: string
  E2B_DOMAIN?: string
}

const userConfig = safeGetUserConfig() as UserConfigWithDomain | null
const domain =
  process.env.E2B_DOMAIN ||
  userConfig?.E2B_DOMAIN ||
  userConfig?.domain ||
  'e2b.app'
const apiKey = process.env.E2B_API_KEY || userConfig?.teamApiKey
const hasCreds = Boolean(apiKey)
const testIf = test.skipIf(!hasCreds)

const cliPath = path.join(process.cwd(), 'dist', 'index.js')
const templateName = `cli-create-api-key-test-${Date.now()}`
const perTestTimeoutMs = parseEnvInt(
  'E2B_CLI_BACKEND_TEST_TIMEOUT_MS',
  300_000
)

describe('template create cli backend integration', () => {
  let testDir: string

  beforeAll(async () => {
    if (!hasCreds) return
    testDir = await fs.mkdtemp('e2b-create-test-')
    await fs.writeFile(
      path.join(testDir, 'e2b.Dockerfile'),
      'FROM ubuntu:latest\n'
    )
  })

  afterAll(async () => {
    if (testDir) {
      try {
        runCli(['template', 'delete', '--yes', templateName])
      } catch (err) {
        console.warn(
          `Failed to delete template ${templateName} in cleanup: ${String(err)}`
        )
      }
      await fs.rm(testDir, { recursive: true, force: true })
    }
  })

  testIf(
    'template create succeeds with E2B_API_KEY alone (no E2B_ACCESS_TOKEN)',
    { timeout: perTestTimeoutMs },
    () => {
      const result = runCli([
        'template',
        'create',
        templateName,
        '--path',
        testDir,
      ])
      const output = bufferToText(result.stdout) + bufferToText(result.stderr)

      expect(result.status, output).toBe(0)
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
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    E2B_DOMAIN: domain,
    E2B_API_KEY: apiKey,
  }
  return spawnSync('node', [cliPath, ...args], {
    env,
    encoding: 'utf8',
    timeout: perTestTimeoutMs,
  })
}

function safeGetUserConfig(): ReturnType<typeof getUserConfig> | null {
  try {
    return getUserConfig()
  } catch (err) {
    console.warn(`Failed to read ~/.e2b/config.json: ${String(err)}`)
    return null
  }
}

function bufferToText(value: Buffer | string | null | undefined): string {
  if (!value) return ''
  return typeof value === 'string' ? value : value.toString('utf8')
}

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
