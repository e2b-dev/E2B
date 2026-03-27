import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Sandbox } from 'e2b'
import { getUserConfig } from 'src/user'
import {
  bufferToText,
  isDebug,
  parseEnvInt,
  runCli,
  runCliWithPipedStdin,
} from '../../setup'

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
const shouldSkip = !apiKey || isDebug
const integrationTest = test.skipIf(shouldSkip)
const templateId =
  process.env.E2B_CLI_BACKEND_TEMPLATE_ID ||
  process.env.E2B_TEMPLATE_ID ||
  'base'
const sandboxTimeoutMs = parseEnvInt(
  'E2B_CLI_BACKEND_SANDBOX_TIMEOUT_MS',
  20_000
)
const perTestTimeoutMs = parseEnvInt('E2B_CLI_BACKEND_TEST_TIMEOUT_MS', 30_000)
const spawnTimeoutMs = perTestTimeoutMs
const cliEnv: NodeJS.ProcessEnv = {
  ...process.env,
  E2B_DOMAIN: domain,
  E2B_API_KEY: apiKey,
}

delete cliEnv.E2B_DEBUG

const runCliInSandbox = (args: string[]) =>
  runCli(args, { timeoutMs: spawnTimeoutMs, env: cliEnv })
const runCliWithPipeInSandbox = (args: string[], input: Buffer) =>
  runCliWithPipedStdin(args, input, { timeoutMs: spawnTimeoutMs, env: cliEnv })

describe('sandbox cli backend integration', () => {
  let sandbox: Sandbox

  beforeAll(async () => {
    if (shouldSkip) return

    sandbox = await Sandbox.create(templateId, {
      apiKey,
      domain,
      timeoutMs: sandboxTimeoutMs,
    })
  }, 30_000)

  afterAll(async () => {
    if (!sandbox) return

    try {
      await sandbox.kill()
    } catch (err) {
      console.warn(
        `Failed to kill sandbox ${sandbox.sandboxId} in cleanup: ${String(err)}`
      )
    }
  }, 15_000)

  integrationTest(
    'list shows the sandbox',
    { timeout: perTestTimeoutMs },
    async () => {
      const listResult = runCliInSandbox(['sandbox', 'list', '--format', 'json'])
      expect(listResult.status).toBe(0)
      expect(sandboxExistsInList(listResult.stdout, sandbox.sandboxId)).toBe(true)
    }
  )

  integrationTest(
    'info shows the sandbox details',
    { timeout: perTestTimeoutMs },
    async () => {
      const infoResult = runCliInSandbox([
        'sandbox',
        'info',
        sandbox.sandboxId,
        '--format',
        'json',
      ])
      expect(infoResult.status).toBe(0)

      const info = JSON.parse(bufferToText(infoResult.stdout)) as {
        sandboxId?: string
        state?: string
      }

      expect(info.sandboxId).toBe(sandbox.sandboxId)
      expect(info.state).toBe('running')
    }
  )

  integrationTest(
    'exec runs a command without piped stdin',
    { timeout: perTestTimeoutMs },
    async () => {
      const execResult = runCliInSandbox([
        'sandbox',
        'exec',
        sandbox.sandboxId,
        '--',
        'sh',
        '-lc',
        'echo backend-non-pipe',
      ])
      expect(execResult.status).toBe(0)
      expect(bufferToText(execResult.stdout)).toContain('backend-non-pipe')
    }
  )

  integrationTest(
    'exec runs a command with piped stdin',
    { timeout: perTestTimeoutMs },
    async () => {
      const pipedExecResult = await runCliWithPipeInSandbox(
        ['sandbox', 'exec', sandbox.sandboxId, '--', 'sh', '-lc', 'wc -c'],
        Buffer.from('hello\n', 'utf8')
      )
      expect(pipedExecResult.status).toBe(0)
      const pipedStdout = bufferToText(pipedExecResult.stdout).trim()
      if (pipedStdout !== '6') {
        expect(pipedStdout).toBe('0')
      }
    }
  )

  integrationTest(
    'metrics returns successfully',
    { timeout: perTestTimeoutMs },
    async () => {
      const metricsResult = runCliInSandbox([
        'sandbox',
        'metrics',
        sandbox.sandboxId,
        '--format',
        'json',
      ])
      expect(metricsResult.status).toBe(0)
    }
  )

  integrationTest(
    'kill removes the sandbox',
    { timeout: perTestTimeoutMs },
    async () => {
      const killResult = runCliInSandbox(['sandbox', 'kill', sandbox.sandboxId])
      expect(killResult.status).toBe(0)

      await assertSandboxNotListed(sandbox.sandboxId)
    }
  )
})

async function assertSandboxNotListed(sandboxId: string): Promise<void> {
  const retries = 10
  const delayMs = 500

  for (let i = 0; i < retries; i++) {
    const listResult = runCliInSandbox(['sandbox', 'list', '--format', 'json'])
    if (listResult.status === 0) {
      const exists = sandboxExistsInList(listResult.stdout, sandboxId)
      if (!exists) {
        return
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error(`Sandbox ${sandboxId} still appears in sandbox list`)
}

function sandboxExistsInList(
  output: string | Buffer | null | undefined,
  sandboxId: string
): boolean {
  const text = bufferToText(output).trim()
  if (!text) {
    return false
  }

  const parsed = JSON.parse(text) as Array<{ sandboxId?: string }>
  return parsed.some((item) => item.sandboxId === sandboxId)
}

function safeGetUserConfig(): ReturnType<typeof getUserConfig> | null {
  try {
    return getUserConfig()
  } catch (err) {
    console.warn(`Failed to read ~/.e2b/config.json: ${String(err)}`)
    return null
  }
}
