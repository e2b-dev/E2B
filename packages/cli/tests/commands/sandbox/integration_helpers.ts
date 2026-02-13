import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

import { getUserConfig } from 'src/user'

type UserConfigWithDomain = NonNullable<ReturnType<typeof getUserConfig>> & {
  domain?: string
  E2B_DOMAIN?: string
}

type ResolveSandboxConfigOptions = {
  templateEnvVars: string[]
}

type CliRunOptions = {
  domain: string
  apiKey?: string
  timeoutMs: number
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

export function resolveSandboxConfig({
  templateEnvVars,
}: ResolveSandboxConfigOptions): {
  domain: string
  apiKey: string | undefined
  templateId: string
  shouldSkip: boolean
} {
  const userConfig = safeGetUserConfig() as UserConfigWithDomain | null
  const domain =
    process.env.E2B_DOMAIN ||
    userConfig?.E2B_DOMAIN ||
    userConfig?.domain ||
    'e2b.app'
  const apiKey = process.env.E2B_API_KEY || userConfig?.teamApiKey

  const templateId = firstDefinedEnv(templateEnvVars) ?? 'base'

  const shouldSkip = !apiKey || process.env.E2B_DEBUG !== undefined

  return {
    domain,
    apiKey,
    templateId,
    shouldSkip,
  }
}

export function runCli(
  args: string[],
  options: CliRunSyncOptions
): ReturnType<typeof spawnSync> {
  return spawnSync('node', [cliPath, ...args], {
    env: getCliEnv(options.domain, options.apiKey),
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
      env: getCliEnv(options.domain, options.apiKey),
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

function getCliEnv(domain: string, apiKey?: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    E2B_DOMAIN: domain,
    E2B_API_KEY: apiKey,
  }
}

function firstDefinedEnv(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]
    if (value) {
      return value
    }
  }
  return undefined
}

function safeGetUserConfig(): ReturnType<typeof getUserConfig> | null {
  try {
    return getUserConfig()
  } catch (err) {
    console.warn(`Failed to read ~/.e2b/config.json: ${String(err)}`)
    return null
  }
}
