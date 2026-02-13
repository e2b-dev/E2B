import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Sandbox } from 'e2b'

import {
  bufferToText,
  parseEnvInt,
  resolveSandboxConfig,
  runCli,
  runCliWithPipedStdin,
} from './integration_helpers'

const { domain, apiKey, templateId, shouldSkip } = resolveSandboxConfig({
  templateEnvVars: ['E2B_CLI_BACKEND_TEMPLATE_ID', 'E2B_TEMPLATE_ID'],
})
const testIf = test.skipIf(shouldSkip)
const sandboxTimeoutMs = parseEnvInt(
  'E2B_CLI_BACKEND_SANDBOX_TIMEOUT_MS',
  20_000
)
const perTestTimeoutMs = parseEnvInt('E2B_CLI_BACKEND_TEST_TIMEOUT_MS', 30_000)
const spawnTimeoutMs = perTestTimeoutMs

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

  testIf('list shows the sandbox', { timeout: perTestTimeoutMs }, async () => {
    const listResult = runCli(['sandbox', 'list', '--format', 'json'], {
      domain,
      apiKey,
      timeoutMs: spawnTimeoutMs,
    })
    expect(listResult.status).toBe(0)
    expect(sandboxExistsInList(listResult.stdout, sandbox.sandboxId)).toBe(true)
  })

  testIf(
    'exec runs a command without piped stdin',
    { timeout: perTestTimeoutMs },
    async () => {
      const execResult = runCli([
        'sandbox', 'exec', sandbox.sandboxId, '--', 'sh', '-lc', 'echo backend-non-pipe',
      ], { domain, apiKey, timeoutMs: spawnTimeoutMs })
      expect(execResult.status).toBe(0)
      expect(bufferToText(execResult.stdout)).toContain('backend-non-pipe')
    }
  )

  testIf(
    'exec runs a command with piped stdin',
    { timeout: perTestTimeoutMs },
    async () => {
      const pipedExecResult = await runCliWithPipedStdin(
        ['sandbox', 'exec', sandbox.sandboxId, '--', 'sh', '-lc', 'wc -c'],
        Buffer.from('hello\n', 'utf8'),
        { domain, apiKey, timeoutMs: spawnTimeoutMs }
      )
      expect(pipedExecResult.status).toBe(0)
      const pipedStdout = bufferToText(pipedExecResult.stdout).trim()
      if (pipedStdout !== '6') {
        expect(pipedStdout).toBe('0')
      }
    }
  )

  testIf(
    'logs returns successfully',
    { timeout: perTestTimeoutMs },
    async () => {
      const logsResult = runCli([
        'sandbox',
        'logs',
        sandbox.sandboxId,
        '--format',
        'json',
      ], { domain, apiKey, timeoutMs: spawnTimeoutMs })
      expect(logsResult.status).toBe(0)
    }
  )

  testIf(
    'metrics returns successfully',
    { timeout: perTestTimeoutMs },
    async () => {
      const metricsResult = runCli([
        'sandbox',
        'metrics',
        sandbox.sandboxId,
        '--format',
        'json',
      ], { domain, apiKey, timeoutMs: spawnTimeoutMs })
      expect(metricsResult.status).toBe(0)
    }
  )

  testIf(
    'kill removes the sandbox',
    { timeout: perTestTimeoutMs },
    async () => {
      const killResult = runCli(['sandbox', 'kill', sandbox.sandboxId], {
        domain,
        apiKey,
        timeoutMs: spawnTimeoutMs,
      })
      expect(killResult.status).toBe(0)

      await assertSandboxNotListed(sandbox.sandboxId)
    }
  )
})

async function assertSandboxNotListed(sandboxId: string): Promise<void> {
  const retries = 10
  const delayMs = 500

  for (let i = 0; i < retries; i++) {
    const listResult = runCli(['sandbox', 'list', '--format', 'json'], {
      domain,
      apiKey,
      timeoutMs: spawnTimeoutMs,
    })
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
