import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  detectInstallMethod,
  fetchLatestVersion,
  getUpdateCommand,
  getUpdateCommandDisplay,
  isNewer,
  isUpdateCacheStale,
  readUpdateCache,
  refreshUpdateCache,
  shouldPrompt,
  UPDATE_CHECK_INTERVAL_MS,
  writeUpdateCache,
} from '../../src/utils/updater'

const installMethodCases: Array<[string, string]> = [
  [
    '/opt/homebrew/Cellar/e2b/2.22.0/libexec/lib/node_modules/@e2b/cli/dist/index.js',
    'brew',
  ],
  [
    '/home/linuxbrew/.linuxbrew/Cellar/e2b/2.22.0/libexec/lib/node_modules/@e2b/cli/dist/index.js',
    'brew',
  ],
  ['/usr/local/lib/node_modules/@e2b/cli/dist/index.js', 'npm'],
  [
    '/home/me/.nvm/versions/node/v24.1.0/lib/node_modules/@e2b/cli/dist/index.js',
    'npm',
  ],
  [
    'C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@e2b\\cli\\dist\\index.js',
    'npm',
  ],
  [
    '/home/me/.local/share/pnpm/global/5/.pnpm/@e2b+cli@2.22.2/node_modules/@e2b/cli/dist/index.js',
    'pnpm',
  ],
  ['/home/me/.bun/install/global/node_modules/@e2b/cli/dist/index.js', 'bun'],
  ['/home/me/.npm/_npx/abc123/node_modules/@e2b/cli/dist/index.js', 'other'],
  ['/home/me/project/node_modules/@e2b/cli/dist/index.js', 'other'],
]

const versionCases: Array<[string, string, boolean]> = [
  ['2.22.2', '2.22.0', true],
  ['2.10.0', '2.9.9', true],
  ['2.22.0', '2.22.0', false],
  ['2.21.9', '2.22.0', false],
  ['2.23.0-beta.1', '2.22.0', true],
  ['garbage', '2.22.0', false],
]

describe('detectInstallMethod', () => {
  test.each(installMethodCases)(
    'detects %s as %s',
    (binPath: string, expected: string) => {
      expect(detectInstallMethod(binPath)).toBe(expected)
    }
  )
})

describe('getUpdateCommand', () => {
  test('returns updater commands and display strings', () => {
    expect(getUpdateCommand('npm')).toEqual({
      command: 'npm',
      args: ['install', '-g', '@e2b/cli@latest'],
    })
    expect(getUpdateCommandDisplay('npm')).toBe(
      'npm install -g @e2b/cli@latest'
    )
    expect(getUpdateCommand('pnpm')).toEqual({
      command: 'pnpm',
      args: ['add', '-g', '@e2b/cli@latest'],
    })
    expect(getUpdateCommandDisplay('pnpm')).toBe('pnpm add -g @e2b/cli@latest')
    expect(getUpdateCommand('bun')).toEqual({
      command: 'bun',
      args: ['add', '-g', '@e2b/cli@latest'],
    })
    expect(getUpdateCommandDisplay('bun')).toBe('bun add -g @e2b/cli@latest')
    expect(getUpdateCommand('brew')).toEqual({
      command: 'brew',
      args: ['upgrade', 'e2b'],
    })
    expect(getUpdateCommandDisplay('brew')).toBe('brew upgrade e2b')
    expect(getUpdateCommand('other')).toBeUndefined()
    expect(getUpdateCommandDisplay('other')).toBeUndefined()
  })
})

describe('isNewer', () => {
  test.each(versionCases)(
    '%s compared to %s is newer: %s',
    (latest: string, current: string, expected: boolean) => {
      expect(isNewer(latest, current)).toBe(expected)
    }
  )
})

describe('fetchLatestVersion', () => {
  test('fetches the stable Homebrew formula version', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ versions: { stable: '2.22.0' } }),
    } as Response)

    await expect(fetchLatestVersion('brew', fetchFn)).resolves.toBe('2.22.0')
    expect(fetchFn).toHaveBeenCalledWith(
      'https://formulae.brew.sh/api/formula/e2b.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  test('fetches the npm registry version', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.22.2' }),
    } as Response)

    await expect(fetchLatestVersion('npm', fetchFn)).resolves.toBe('2.22.2')
    expect(fetchFn).toHaveBeenCalledWith(
      'https://registry.npmjs.org/@e2b/cli/latest',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  test('rejects non-2xx responses', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 503,
    } as Response)

    await expect(fetchLatestVersion('npm', fetchFn)).rejects.toThrow(
      'Update check failed with status 503'
    )
  })
})

describe('update cache', () => {
  let tempDir: string | undefined

  afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = undefined
  })

  test('determines freshness using the configured interval', () => {
    const now = Date.parse('2026-01-01T20:00:00.000Z')
    const fresh = {
      lastCheckedAt: new Date(now - UPDATE_CHECK_INTERVAL_MS + 1).toISOString(),
      latestVersion: '2.22.2',
    }
    const stale = {
      lastCheckedAt: new Date(now - UPDATE_CHECK_INTERVAL_MS).toISOString(),
      latestVersion: '2.22.2',
    }

    expect(isUpdateCacheStale(fresh, now)).toBe(false)
    expect(isUpdateCacheStale(stale, now)).toBe(true)
    expect(isUpdateCacheStale(undefined, now)).toBe(true)
  })

  test('treats a corrupt cache file as stale', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-updater-test-'))
    const cachePath = path.join(tempDir, 'update-check.json')
    fs.writeFileSync(cachePath, '{')

    expect(readUpdateCache(cachePath)).toBeUndefined()
    expect(isUpdateCacheStale(readUpdateCache(cachePath))).toBe(true)
  })

  test('refreshes the latest version without losing a dismissed version', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-updater-test-'))
    const cachePath = path.join(tempDir, 'update-check.json')
    writeUpdateCache(
      {
        lastCheckedAt: '2025-01-01T00:00:00.000Z',
        latestVersion: '2.22.0',
        dismissedVersion: '2.22.0',
      },
      cachePath
    )
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '2.22.2' }),
    } as Response)
    const now = Date.parse('2026-01-01T20:00:00.000Z')

    await expect(
      refreshUpdateCache('npm', { cachePath, fetchFn, now: () => now })
    ).resolves.toEqual({
      lastCheckedAt: new Date(now).toISOString(),
      latestVersion: '2.22.2',
      dismissedVersion: '2.22.0',
    })
  })
})

describe('shouldPrompt', () => {
  type PromptOverrides = Partial<Parameters<typeof shouldPrompt>[0]>

  const defaults = {
    currentVersion: '2.22.0',
    latestVersion: '2.22.2',
    method: 'npm' as const,
    stdinIsTTY: true,
    stdoutIsTTY: true,
    env: {},
    argv: ['auth', 'info'],
  }

  const promptCases: Array<[string, PromptOverrides]> = [
    ['dismissed version', { dismissedVersion: '2.22.2' }],
    ['unknown install method', { method: 'other' }],
    ['non-interactive stdin', { stdinIsTTY: false }],
    ['non-interactive stdout', { stdoutIsTTY: false }],
    ['CI', { env: { CI: '1' } }],
    ['NO_UPDATE_NOTIFIER', { env: { NO_UPDATE_NOTIFIER: '1' } }],
    ['development environment', { env: { NODE_ENV: 'development' } }],
    ['short version option', { argv: ['-V'] }],
    ['version option', { argv: ['--version'] }],
    ['help option', { argv: ['-h'] }],
    ['long help option', { argv: ['--help'] }],
    ['help command', { argv: ['help'] }],
    ['update command', { argv: ['update'] }],
  ]

  test('allows the interactive update prompt', () => {
    expect(shouldPrompt(defaults)).toBe(true)
  })

  test.each(promptCases)(
    'does not prompt for %s',
    (_condition: string, options: PromptOverrides) => {
      expect(shouldPrompt({ ...defaults, ...options })).toBe(false)
    }
  )
})
