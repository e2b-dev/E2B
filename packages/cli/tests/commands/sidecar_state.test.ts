import * as commander from 'commander'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  NotFoundError,
  Sandbox,
  SidecarStateInfo,
  SidecarStateVersionInfo,
} from 'e2b'

vi.mock('src/api', () => ({ ensureAPIKey: () => 'test-api-key' }))

import {
  formatSidecarStateTable,
  formatSidecarStateVersionTable,
  parseVersionOption,
  sidecarStateCommand,
} from '../../src/commands/sidecarState'

const states: SidecarStateInfo[] = [
  {
    name: 'project-db',
    entry: 'sqlite',
    sizeMiB: 512,
    latestVersion: 2,
    versionCount: 2,
    createdAt: new Date('2026-09-19T09:00:00Z'),
    updatedAt: new Date('2026-09-20T10:00:00Z'),
  },
  {
    name: 'warm-cache',
    entry: 'valkey',
    sizeMiB: 256,
    latestVersion: 1,
    versionCount: 1,
    createdAt: new Date('2026-09-20T08:00:00Z'),
    updatedAt: new Date('2026-09-20T08:00:00Z'),
  },
]

const versions: SidecarStateVersionInfo[] = [
  {
    name: 'project-db',
    entry: 'sqlite',
    version: 2,
    entryVersion: '0.24.32',
    sizeBytes: 4194304,
    sourceSandboxId: 'sbx-2',
    createdAt: new Date('2026-09-20T10:00:00Z'),
  },
  {
    name: 'project-db',
    entry: 'sqlite',
    version: 1,
    entryVersion: '0.24.31',
    sizeBytes: 1048576,
    sourceSandboxId: 'sbx-1',
    createdAt: new Date('2026-09-19T09:00:00Z'),
  },
]

describe('sidecar-state tables', () => {
  test('lists a state with its size class, latest version and count', () => {
    expect(formatSidecarStateTable(states)).toEqual([
      'NAME         ENTRY    SIZE MIB   LATEST   VERSIONS   UPDATED AT',
      `project-db   sqlite   512        2        2          ${states[0].updatedAt.toLocaleString()}`,
      `warm-cache   valkey   256        1        1          ${states[1].updatedAt.toLocaleString()}`,
    ])
  })

  test('lists a version with its entry version, size and source sandbox', () => {
    expect(formatSidecarStateVersionTable(versions)).toEqual([
      'VERSION   ENTRY VERSION   SIZE      SOURCE SANDBOX   CREATED AT',
      `2         0.24.32         4.0 MiB   sbx-2            ${versions[0].createdAt.toLocaleString()}`,
      `1         0.24.31         1.0 MiB   sbx-1            ${versions[1].createdAt.toLocaleString()}`,
    ])
  })

  test('renders an empty table as headers only', () => {
    expect(formatSidecarStateTable([])).toEqual([
      'NAME   ENTRY   SIZE MIB   LATEST   VERSIONS   UPDATED AT',
    ])
  })

  test('registers list, get, delete and save', () => {
    expect(
      sidecarStateCommand.commands
        .map((command: { name: () => string }) => command.name())
        .sort()
    ).toEqual(['delete', 'get', 'list', 'save'])
  })
})

describe('sidecar-state delete --version', () => {
  test.each(['2.9', '2junk', '1e2', '0', '-1', '', ' 2', '0x2'])(
    'rejects %o instead of coercing it to a version',
    (value: string) => {
      expect(() => parseVersionOption(value)).toThrowError(
        commander.InvalidArgumentError
      )
    }
  )

  test('accepts a plain decimal integer', () => {
    expect(parseVersionOption('2')).toBe(2)
    expect(parseVersionOption('012')).toBe(12)
  })
})

describe('sidecar-state delete not-found reporting', () => {
  const strip = (value: string) =>
    // eslint-disable-next-line no-control-regex
    value.replace(/\u001b\[[0-9;]*m/g, '')

  async function runDelete(args: string[]): Promise<string> {
    const errors: string[] = []
    // One long-lived Command per process in the CLI, one per test here.
    sidecarStateCommand.commands
      .find((command) => command.name() === 'delete')
      ?.setOptionValue('version', undefined)
    vi.spyOn(Sandbox, 'deleteSidecarState').mockRejectedValue(
      new NotFoundError('sidecar_state_version_unknown: version 9 not found')
    )
    vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
      errors.push(parts.map(String).join(' '))
    })
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit')
    }) as never)

    await expect(
      sidecarStateCommand.parseAsync(['delete', ...args], { from: 'user' })
    ).rejects.toThrow('exit')

    return strip(errors.join('\n'))
  }

  afterEach(() => vi.restoreAllMocks())

  test('names the version when one was asked for', async () => {
    expect(await runDelete(['project-db', '--version', '9'])).toBe(
      "Version 9 of sidecar state project-db wasn't found"
    )
  })

  test('names the state when the whole name was asked for', async () => {
    expect(await runDelete(['project-db'])).toBe(
      "Sidecar state project-db wasn't found"
    )
  })
})
