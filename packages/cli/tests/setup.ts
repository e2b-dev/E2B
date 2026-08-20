import { execSync, spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

import { test } from 'vitest'

import { getUserConfig } from 'src/user'

export const isDebug = process.env.E2B_DEBUG !== undefined

/**
 * Opt-in flag for the e2e tier: tests that drive the CLI against live
 * infrastructure. The default `pnpm test` run stays fully mocked.
 */
export const isE2E = process.env.E2B_E2E !== undefined

type UserConfigWithDomain = NonNullable<ReturnType<typeof getUserConfig>> & {
  domain?: string
  E2B_DOMAIN?: string
}

function safeGetUserConfig(): UserConfigWithDomain | null {
  try {
    return getUserConfig() as UserConfigWithDomain | null
  } catch (err) {
    console.warn(`Failed to read ~/.e2b/config.json: ${String(err)}`)
    return null
  }
}

const userConfig = safeGetUserConfig()

export const e2eDomain =
  process.env.E2B_DOMAIN ||
  userConfig?.E2B_DOMAIN ||
  userConfig?.domain ||
  'e2b.app'

export const e2eApiKey = process.env.E2B_API_KEY || userConfig?.projectApiKey

/**
 * True when the e2e tier can't run: it needs the explicit opt-in and
 * credentials, and debug mode points the CLI at a local stack instead.
 */
export const skipE2E = !isE2E || !e2eApiKey || isDebug

/** `test` for the e2e tier — skipped unless `E2B_E2E=1` and credentials are set. */
export const e2eTest = test.skipIf(skipE2E)

type CliRunOptions = {
  timeoutMs: number
  env?: NodeJS.ProcessEnv
}

type CliRunSyncOptions = CliRunOptions & {
  input?: string | Buffer
}

export type CliRunResult = {
  status: number | null
  stdout: Buffer
  stderr: Buffer
  error?: Error
}

const cliPath = path.join(process.cwd(), 'dist', 'index.js')

export async function setup() {
  execSync('pnpm build', { stdio: 'inherit' })
}

export function runCli(
  args: string[],
  options: CliRunSyncOptions
): ReturnType<typeof spawnSync> {
  return spawnSync('node', [cliPath, ...args], {
    env: options.env ?? process.env,
    input: options.input,
    encoding: 'utf8',
    timeout: options.timeoutMs,
  })
}

export async function runCliWithPipedStdin(
  args: string[],
  input: Buffer,
  options: CliRunOptions
): Promise<CliRunResult> {
  return await new Promise((resolve) => {
    const child = spawn('node', [cliPath, ...args], {
      env: options.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let childError: Error | undefined
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, options.timeoutMs)

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

export function bufferToText(value: Buffer | string | null | undefined): string {
  if (!value) {
    return ''
  }
  return typeof value === 'string' ? value : value.toString('utf8')
}

export function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }

  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
