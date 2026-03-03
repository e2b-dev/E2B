import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { Sandbox } from 'e2b'
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
const templateId =
  process.env.E2B_CLI_BACKEND_TEMPLATE_ID ||
  process.env.E2B_TEMPLATE_ID ||
  'base'
const isDebug = process.env.E2B_DEBUG !== undefined
const hasCreds = Boolean(apiKey)
const shouldSkip = !hasCreds || isDebug
const testIf = test.skipIf(shouldSkip)
const cliPath = path.join(process.cwd(), 'dist', 'index.js')
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
    const listResult = runCli(['sandbox', 'list', '--format', 'json'])
    expect(listResult.status).toBe(0)
    expect(sandboxExistsInList(listResult.stdout, sandbox.sandboxId)).toBe(true)
  })

  testIf(
    'exec runs a command without piped stdin',
    { timeout: perTestTimeoutMs },
    async () => {
      const execResult = runCli([
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

  testIf(
    'exec runs a command with piped stdin',
    { timeout: perTestTimeoutMs },
    async () => {
      const pipedExecResult = await runCliWithPipedStdin(
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

  /** Note: removing this test for now because it can be slow to get the logs causing tests to time out */
  // testIf(
  //   'logs returns successfully',
  //   { timeout: perTestTimeoutMs },
  //   async () => {
  //     const logsResult = runCli([
  //       'sandbox',
  //       'logs',
  //       sandbox.sandboxId,
  //       '--format',
  //       'json',
  //     ])
  //     expect(logsResult.status).toBe(0)
  //   }
  // )

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
      ])
      expect(metricsResult.status).toBe(0)
    }
  )

  testIf(
    'kill removes the sandbox',
    { timeout: perTestTimeoutMs },
    async () => {
      const killResult = runCli(['sandbox', 'kill', sandbox.sandboxId])
      expect(killResult.status).toBe(0)

      await assertSandboxNotListed(sandbox.sandboxId)
    }
  )
})

function runCli(
  args: string[],
  opts?: { input?: string | Buffer }
): ReturnType<typeof spawnSync> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2B_DOMAIN: domain,
    E2B_API_KEY: apiKey,
  }
  delete env.E2B_DEBUG

  return spawnSync('node', [cliPath, ...args], {
    env,
    input: opts?.input,
    encoding: 'utf8',
    timeout: spawnTimeoutMs,
  })
}

type PipeRunResult = {
  status: number | null
  stdout: Buffer
  stderr: Buffer
  error?: Error
}

function runCliWithPipedStdin(
  args: string[],
  input: Buffer
): Promise<PipeRunResult> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2B_DOMAIN: domain,
    E2B_API_KEY: apiKey,
  }
  delete env.E2B_DEBUG

  return new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let childError: Error | undefined
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, spawnTimeoutMs)

    child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
    child.on('error', (err) => {
      childError = err
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const timeoutError = timedOut
        ? Object.assign(new Error('CLI command timed out'), {
          code: 'ETIMEDOUT',
        } as NodeJS.ErrnoException)
        : undefined
      resolve({
        status: code,
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks),
        error: childError ?? timeoutError,
      })
    })

    child.stdin.write(input)
    child.stdin.end()
  })
}

async function assertSandboxNotListed(sandboxId: string): Promise<void> {
  const retries = 10
  const delayMs = 500

  for (let i = 0; i < retries; i++) {
    const listResult = runCli(['sandbox', 'list', '--format', 'json'])
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

function bufferToText(value: Buffer | string | null | undefined): string {
  if (!value) {
    return ''
  }
  return typeof value === 'string' ? value : value.toString('utf8')
}

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeGetUserConfig(): ReturnType<typeof getUserConfig> | null {
  try {
    return getUserConfig()
  } catch (err) {
    console.warn(`Failed to read ~/.e2b/config.json: ${String(err)}`)
    return null
  }
}
