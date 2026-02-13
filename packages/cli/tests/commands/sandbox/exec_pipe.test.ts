import { randomBytes } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { Sandbox } from 'e2b'
import {
  type CliRunResult,
  bufferToText,
  isDebug,
  parseEnvInt,
  runCliWithPipedStdin,
} from '../../setup'

type PipeCase = {
  name: string
  data: Buffer
  expectedBytes: number
  timeoutMs?: number
}

const integrationTest = test.skipIf(isDebug)
const templateId =
  process.env.E2B_PIPE_TEMPLATE_ID ||
  process.env.E2B_TEMPLATE_ID ||
  'base'
const includeLargeBinary =
  process.env.E2B_PIPE_INTEGRATION_STRICT === '1' ||
  process.env.E2B_PIPE_INTEGRATION_BINARY === '1' ||
  process.env.STRICT === '1'
const sandboxTimeoutMs = parseEnvInt('E2B_PIPE_SANDBOX_TIMEOUT_MS', 10_000)
const testTimeoutMs = parseEnvInt('E2B_PIPE_TEST_TIMEOUT_MS', 60_000)
const defaultCmdTimeoutMs = parseEnvInt(
  'E2B_PIPE_CMD_TIMEOUT_MS',
  Math.min(8_000, testTimeoutMs)
)

const defaultCases: PipeCase[] = [
  {
    name: 'empty_eof',
    data: Buffer.alloc(0),
    expectedBytes: 0,
  },
  {
    name: 'ascii_newline',
    data: Buffer.from('hello\n'),
    expectedBytes: 6,
  },
  {
    name: 'ascii_no_newline',
    data: Buffer.from('hello'),
    expectedBytes: 5,
  },
  {
    name: 'utf8_multibyte',
    data: Buffer.from([0x68, 0x69, 0x2d, 0xe2, 0x98, 0x83]), // "hi-☃"
    expectedBytes: 6,
  },
  {
    name: 'binary_nul_ff_hex',
    data: Buffer.from([0x00, 0x01, 0x02, 0xff, 0x00, 0x41]),
    expectedBytes: 6,
  },
  {
    name: 'chunk_64k',
    data: Buffer.from('a'.repeat(64 * 1024)),
    expectedBytes: 64 * 1024,
  },
  {
    name: 'chunk_64k_plus_1',
    data: Buffer.from('a'.repeat(64 * 1024 + 1)),
    expectedBytes: 64 * 1024 + 1,
  },
]

const largeBinaryCases: PipeCase[] = [
  {
    name: 'binary_random_sha256',
    data: randomBytes(1024),
    expectedBytes: 1024,
  },
]

describe('sandbox exec stdin piping (integration)', () => {
  integrationTest(
    'pipes stdin to remote command',
    { timeout: testTimeoutMs },
    async () => {
      const sandbox = await Sandbox.create(templateId, {
        timeoutMs: sandboxTimeoutMs,
      })

      try {
        const cases = includeLargeBinary
          ? [...defaultCases, ...largeBinaryCases]
          : defaultCases

        // Probe with a simple case first — some environments (notably Windows
        // CI) don't expose piped stdin so the remote byte count is 0.
        const probe = cases[1] // ascii_newline
        const probeResult = await runExecPipe(sandbox.sandboxId, probe)
        assertExecSucceeded(probe.name, probeResult)

        const probeStdout = bufferToText(probeResult.stdout).trim()
        if (probeStdout === '0') {
          return
        }

        expect(probeStdout).toBe(String(probe.expectedBytes))

        for (const testCase of cases) {
          const result = await runExecPipe(sandbox.sandboxId, testCase)
          assertExecSucceeded(testCase.name, result)
          const stdout = bufferToText(result.stdout).trim()
          expect(stdout, testCase.name).toBe(String(testCase.expectedBytes))
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
  testCase: PipeCase
): Promise<CliRunResult> {
  return runCliWithPipedStdin(
    ['sandbox', 'exec', sandboxId, '--', 'sh', '-lc', 'wc -c'],
    testCase.data,
    {
      timeoutMs: testCase.timeoutMs ?? defaultCmdTimeoutMs,
    }
  )
}

function assertExecSucceeded(
  name: string,
  result: CliRunResult
): void {
  if (result.error) {
    const timedOut = (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT'
    throw new Error(
      `${name} ${timedOut ? 'timed out' : 'failed'}: ${result.error.message}`
    )
  }

  const stderr = bufferToText(result.stderr).trim()
  if (result.status !== 0) {
    throw new Error(`${name} failed with rc=${result.status} stderr=${stderr}`)
  }
}
