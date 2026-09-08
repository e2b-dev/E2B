import { Command } from 'commander'
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  parseNonNegativeInt,
  minFreeDiskMbOption,
  deprecatedFreeDiskSpaceMbOption,
  minFreeDiskMbFromOptions,
} from '../src/options'

afterEach(() => vi.restoreAllMocks())

describe('minimum free disk options', () => {
  test.each(['', '   ', '-1', '1.5', 'abc'])(
    'rejects malformed value %j',
    (value: string) => {
      expect(() => parseNonNegativeInt('Value')(value)).toThrow(
        'Value must be a non-negative integer.'
      )
    }
  )

  test.each([
    [[], undefined],
    [['--min-free-disk-mb', '0'], 0],
    [['--min-free-disk-mb', '20480'], 20480],
    [['--free-disk-space-mb', '0'], 0],
    [['--min-free-disk-mb', '0', '--free-disk-space-mb', '0'], 0],
  ] as const)('parses %j', (args: readonly string[], expected: number | undefined) => {
    const warning = vi.spyOn(console, 'error').mockImplementation(() => {})
    const command = new Command()
      .addOption(minFreeDiskMbOption)
      .addOption(deprecatedFreeDiskSpaceMbOption)
    command.parse([...args], { from: 'user' })
    expect(minFreeDiskMbFromOptions(command.opts())).toBe(expected)
    expect(warning).toHaveBeenCalledTimes(
      (args as readonly string[]).includes('--free-disk-space-mb') ? 1 : 0
    )
    expect(command.helpInformation()).toContain('--min-free-disk-mb')
    expect(command.helpInformation()).not.toContain('--free-disk-space-mb')
  })

  test('rejects conflicting aliases, including zero', () => {
    expect(() =>
      minFreeDiskMbFromOptions({ minFreeDiskMb: 0, freeDiskSpaceMb: 1024 })
    ).toThrow('must be equal')
  })
})
