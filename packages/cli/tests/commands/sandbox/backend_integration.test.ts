import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Sandbox } from 'e2b'
import {
  bufferToText,
  isDebug,
  parseEnvInt,
  runCli,
  runCliWithPipedStdin,
} from '../../setup'

const integrationTest = test.skipIf(isDebug)
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
const runCliInSandbox = (args: string[]) =>
  runCli(args, { timeoutMs: spawnTimeoutMs })
const runCliWithPipeInSandbox = (args: string[], input: Buffer) =>
  runCliWithPipedStdin(args, input, { timeoutMs: spawnTimeoutMs })

describe('sandbox cli backend integration', () => {
  let sandbox: Sandbox

  beforeAll(async () => {
    if (isDebug) return

    sandbox = await Sandbox.create(templateId, {
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
    'exec runs a command without piped stdin',
    { timeout: perTestTimeoutMs },
    async () => {
      const execResult = runCliInSandbox([
        'sandbox', 'exec', sandbox.sandboxId, '--', 'sh', '-lc', 'echo backend-non-pipe',
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

  for (const command of ['logs', 'metrics'] as const) {
    integrationTest(
      `${command} returns successfully`,
      { timeout: perTestTimeoutMs },
      async () => {
        const result = runCliInSandbox([
          'sandbox',
          command,
          sandbox.sandboxId,
          '--format',
          'json',
        ])
        expect(result.status).toBe(0)
      }
    )
  }

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
