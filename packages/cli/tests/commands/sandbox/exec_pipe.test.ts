import { createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { Sandbox } from 'e2b'
import { getUserConfig } from 'src/user'
import { shellQuote } from 'src/commands/sandbox/exec_helpers'

type SmokeCase = {
  name: string
  data: Buffer
  readBytes: number
  expr: string
  expected?: string
  expectTimeout?: boolean
  timeoutMs?: number
}

const userConfig = safeGetUserConfig()
const domain = process.env.E2B_DOMAIN || userConfig?.domain || 'e2b.app'
const apiKey = process.env.E2B_API_KEY || userConfig?.teamApiKey
const templateId =
  process.env.E2B_PIPE_TEMPLATE_ID ||
  process.env.E2B_TEMPLATE_ID ||
  'base'
const isDebug = process.env.E2B_DEBUG !== undefined
const hasCreds = Boolean(apiKey)
const shouldRun = hasCreds && !isDebug
const testIf = shouldRun ? test : test.skip
const includeBinary =
  process.env.E2B_PIPE_SMOKE_STRICT === '1' ||
  process.env.E2B_PIPE_SMOKE_BINARY === '1' ||
  process.env.STRICT === '1'
const sandboxTimeoutMs = parseEnvInt('E2B_PIPE_SANDBOX_TIMEOUT_MS', 10_000)
const testTimeoutMs = parseEnvInt('E2B_PIPE_TEST_TIMEOUT_MS', 3_000)
const defaultCmdTimeoutMs = parseEnvInt(
  'E2B_PIPE_CMD_TIMEOUT_MS',
  Math.min(3_000, testTimeoutMs)
)
const emptyTimeoutMs = parseEnvInt(
  'E2B_PIPE_EMPTY_TIMEOUT_MS',
  Math.min(750, defaultCmdTimeoutMs)
)

const cliPath = path.join(process.cwd(), 'dist', 'index.js')

const textCases: SmokeCase[] = [
  {
    name: 'empty_blocks',
    data: Buffer.alloc(0),
    readBytes: 1,
    expr: 'len(data)',
    expectTimeout: true,
    timeoutMs: emptyTimeoutMs,
  },
  {
    name: 'ascii_newline',
    data: Buffer.from('hello\n'),
    readBytes: 6,
    expr: 'len(data)',
    expected: '6',
  },
  {
    name: 'ascii_no_newline',
    data: Buffer.from('hello'),
    readBytes: 5,
    expr: 'len(data)',
    expected: '5',
  },
  {
    name: 'utf8_multibyte',
    data: Buffer.from([0x68, 0x69, 0x2d, 0xe2, 0x98, 0x83]), // "hi-\\u2603"
    readBytes: 6,
    expr: 'len(data)',
    expected: '6',
  },
  {
    name: 'chunk_64k',
    data: Buffer.from('a'.repeat(64 * 1024)),
    readBytes: 64 * 1024,
    expr: 'len(data)',
    expected: String(64 * 1024),
  },
  {
    name: 'chunk_64k_plus_1',
    data: Buffer.from('a'.repeat(64 * 1024 + 1)),
    readBytes: 64 * 1024 + 1,
    expr: 'len(data)',
    expected: String(64 * 1024 + 1),
  },
]

const binaryCases: SmokeCase[] = [
  {
    name: 'binary_nul_ff_hex',
    data: Buffer.from([0x00, 0x01, 0x02, 0xff, 0x00, 0x41]),
    readBytes: 6,
    expr: 'data.hex()',
    expected: '000102ff0041',
  },
  {
    name: 'binary_random_sha256',
    data: randomBytes(1024),
    readBytes: 1024,
    expr: 'hashlib.sha256(data).hexdigest()',
  },
]

describe('sandbox exec stdin piping (integration)', () => {
  testIf(
    'pipes stdin to remote command',
    { timeout: testTimeoutMs },
    async () => {
      if (!shouldRun) {
        return
      }

      const sandbox = await Sandbox.create(templateId, {
        apiKey,
        domain,
        timeoutMs: sandboxTimeoutMs,
      })

      try {
        const cases = includeBinary
          ? [...textCases, ...binaryCases]
          : textCases

        for (const testCase of cases) {
          const expected =
            testCase.expected ??
            (testCase.name === 'binary_random_sha256'
              ? hashBytes(testCase.data)
              : undefined)

          const result = runExecPipe(sandbox.sandboxId, testCase)
          const timedOut = isTimeout(result)

          if (testCase.expectTimeout) {
            expect(timedOut, `${testCase.name} should timeout`).toBe(true)
            continue
          }

          if (timedOut) {
            throw new Error(`${testCase.name} timed out unexpectedly`)
          }

          if (result.error) {
            throw result.error
          }

          const stderr = bufferToText(result.stderr).trim()
          if (result.status !== 0) {
            throw new Error(
              `${testCase.name} failed with rc=${result.status} stderr=${stderr}`
            )
          }

          if (expected !== undefined) {
            const stdout = bufferToText(result.stdout).trim()
            expect(stdout, testCase.name).toBe(expected)
          }
        }
      } finally {
        try {
          await sandbox.kill()
        } catch (err) {
          console.warn(
            `Failed to kill sandbox ${sandbox.sandboxId}: ${String(err)}`
          )
        }
      }
    }
  )
})

function runExecPipe(
  sandboxId: string,
  testCase: SmokeCase
): ReturnType<typeof spawnSync> {
  const pythonCmd = `import sys,hashlib; data=sys.stdin.buffer.read(${testCase.readBytes}); print(${testCase.expr})`
  const cliCmd = [
    'node',
    cliPath,
    'sandbox',
    'exec',
    sandboxId,
    '--',
    'python3',
    '-c',
    pythonCmd,
  ]
    .map(shellQuote)
    .join(' ')

  const payload = testCase.data.toString('base64')
  const script = [
    'set -euo pipefail',
    `python3 - <<'PY' | ${cliCmd}`,
    'import base64, sys',
    `data = base64.b64decode('${payload}')`,
    'sys.stdout.buffer.write(data)',
    'PY',
  ].join('\n')

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2B_DOMAIN: domain,
    E2B_API_KEY: apiKey,
  }
  delete env.E2B_DEBUG

  return spawnSync('bash', ['-lc', script], {
    env,
    timeout: testCase.timeoutMs ?? defaultCmdTimeoutMs,
  })
}

function bufferToText(value: Buffer | string | null | undefined): string {
  if (!value) {
    return ''
  }
  return typeof value === 'string' ? value : value.toString('utf8')
}

function isTimeout(result: ReturnType<typeof spawnSync>): boolean {
  const err = result.error as NodeJS.ErrnoException | undefined
  return Boolean(err && err.code === 'ETIMEDOUT')
}

function hashBytes(value: Buffer): string {
  const hash = createHash('sha256')
  hash.update(value)
  return hash.digest('hex')
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
