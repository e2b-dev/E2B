import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { USER_CONFIG_PATH } from '../user'

type InstallMethod = 'npm' | 'pnpm' | 'bun' | 'brew' | 'other'

interface UpdateCommand {
  command: string
  args: string[]
}

interface UpdateCache {
  lastCheckedAt: string
  latestVersion: string
  dismissedVersion?: string
}

export const UPDATE_CHECK_INTERVAL_MS = 20 * 60 * 60 * 1000

const BREW_FORMULA_URL = 'https://formulae.brew.sh/api/formula/e2b.json'
const NPM_REGISTRY_URL = 'https://registry.npmjs.org/@e2b/cli/latest'

export function detectInstallMethod(binPath: string): InstallMethod {
  const normalized = binPath.replace(/\\/g, '/')
  const lowerPath = normalized.toLowerCase()

  if (normalized.includes('/Cellar/e2b/')) return 'brew'
  if (lowerPath.includes('/_npx/')) return 'other'
  if (lowerPath.includes('/.bun/install/global/')) return 'bun'
  if (lowerPath.includes('/pnpm/global/')) return 'pnpm'
  if (
    lowerPath.includes('/lib/node_modules/@e2b/cli/') ||
    /\/npm\/node_modules\/@e2b\/cli\//i.test(normalized)
  ) {
    return 'npm'
  }

  return 'other'
}

export function getUpdateCommand(
  method: InstallMethod
): UpdateCommand | undefined {
  switch (method) {
    case 'npm':
      return { command: 'npm', args: ['install', '-g', '@e2b/cli@latest'] }
    case 'pnpm':
      return { command: 'pnpm', args: ['add', '-g', '@e2b/cli@latest'] }
    case 'bun':
      return { command: 'bun', args: ['add', '-g', '@e2b/cli@latest'] }
    case 'brew':
      return { command: 'brew', args: ['upgrade', 'e2b'] }
    default:
      return undefined
  }
}

export function getUpdateCommandDisplay(
  method: InstallMethod
): string | undefined {
  const updateCommand = getUpdateCommand(method)
  if (!updateCommand) return undefined
  return [updateCommand.command, ...updateCommand.args].join(' ')
}

export async function fetchLatestVersion(
  method: InstallMethod,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  const url = method === 'brew' ? BREW_FORMULA_URL : NPM_REGISTRY_URL
  const response = await fetchFn(url, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) {
    throw new Error(`Update check failed with status ${response.status}`)
  }

  const data = (await response.json()) as {
    version?: unknown
    versions?: { stable?: unknown }
  }
  const version = method === 'brew' ? data.versions?.stable : data.version
  if (typeof version !== 'string') {
    throw new Error('Update check returned an invalid version')
  }

  return version
}

function parseVersion(version: string): [bigint, bigint, bigint] | undefined {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      version
    )
  if (!match) return undefined
  return [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])]
}

export function isNewer(latest: string, current: string): boolean {
  const latestVersion = parseVersion(latest)
  const currentVersion = parseVersion(current)
  if (!latestVersion || !currentVersion) return false

  for (let index = 0; index < latestVersion.length; index += 1) {
    if (latestVersion[index] > currentVersion[index]) return true
    if (latestVersion[index] < currentVersion[index]) return false
  }

  return false
}

export function getUpdateCachePath(userConfigPath = USER_CONFIG_PATH): string {
  return path.join(path.dirname(userConfigPath), 'update-check.json')
}

function isUpdateCache(value: unknown): value is UpdateCache {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const cache = value as Record<string, unknown>
  return (
    typeof cache.lastCheckedAt === 'string' &&
    Number.isFinite(Date.parse(cache.lastCheckedAt)) &&
    typeof cache.latestVersion === 'string' &&
    (cache.dismissedVersion === undefined ||
      typeof cache.dismissedVersion === 'string')
  )
}

function debugCacheError(error: unknown): void {
  if (process.env.DEBUG) {
    console.error('Update cache error:', error)
  }
}

export function readUpdateCache(
  cachePath = getUpdateCachePath()
): UpdateCache | undefined {
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as unknown
    return isUpdateCache(cache) ? cache : undefined
  } catch (error) {
    debugCacheError(error)
    return undefined
  }
}

export function isUpdateCacheStale(
  cache: UpdateCache | undefined,
  now = Date.now()
): boolean {
  if (!cache) return true
  return now - Date.parse(cache.lastCheckedAt) >= UPDATE_CHECK_INTERVAL_MS
}

export function writeUpdateCache(
  cache: UpdateCache,
  cachePath = getUpdateCachePath()
): void {
  try {
    const existing = readUpdateCache(cachePath)
    const preservedCache = {
      ...cache,
      ...(cache.dismissedVersion === undefined &&
      existing?.dismissedVersion !== undefined
        ? { dismissedVersion: existing.dismissedVersion }
        : {}),
    }
    const dir = path.dirname(cachePath)
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    fs.chmodSync(dir, 0o700)
    fs.writeFileSync(cachePath, JSON.stringify(preservedCache, null, 2), {
      mode: 0o600,
    })
    fs.chmodSync(cachePath, 0o600)
  } catch (error) {
    debugCacheError(error)
  }
}

export async function refreshUpdateCache(
  method: InstallMethod,
  options: {
    cachePath?: string
    fetchFn?: typeof fetch
    now?: () => number
  } = {}
): Promise<UpdateCache | undefined> {
  const cachePath = options.cachePath ?? getUpdateCachePath()
  const now = options.now ?? Date.now

  try {
    const latestVersion = await fetchLatestVersion(method, options.fetchFn)
    const cache: UpdateCache = {
      lastCheckedAt: new Date(now()).toISOString(),
      latestVersion,
    }
    writeUpdateCache(cache, cachePath)
    return readUpdateCache(cachePath) ?? cache
  } catch (error) {
    debugCacheError(error)
    return undefined
  }
}

interface ShouldPromptOptions {
  currentVersion: string
  latestVersion: string
  method: InstallMethod
  dismissedVersion?: string
  stdinIsTTY?: boolean
  stdoutIsTTY?: boolean
  env?: NodeJS.ProcessEnv
  argv?: string[]
}

export function shouldPrompt({
  currentVersion,
  latestVersion,
  method,
  dismissedVersion,
  stdinIsTTY = process.stdin.isTTY,
  stdoutIsTTY = process.stdout.isTTY,
  env = process.env,
  argv = process.argv.slice(2),
}: ShouldPromptOptions): boolean {
  if (
    !isNewer(latestVersion, currentVersion) ||
    latestVersion === dismissedVersion ||
    method === 'other' ||
    !stdinIsTTY ||
    !stdoutIsTTY ||
    env.CI !== undefined ||
    env.NO_UPDATE_NOTIFIER !== undefined ||
    env.NODE_ENV === 'development'
  ) {
    return false
  }

  if (
    argv.some((argument) =>
      ['-V', '--version', '-h', '--help'].includes(argument)
    ) ||
    ['help', 'update'].includes(argv[0])
  ) {
    return false
  }

  return true
}

export function runUpdateCommand(method: InstallMethod): Promise<number> {
  const updateCommand = getUpdateCommand(method)
  if (!updateCommand) return Promise.resolve(1)

  return new Promise((resolve) => {
    try {
      const child = spawn(updateCommand.command, updateCommand.args, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
      })
      child.once('error', () => resolve(1))
      child.once('close', (code) => resolve(code ?? 1))
    } catch {
      resolve(1)
    }
  })
}
