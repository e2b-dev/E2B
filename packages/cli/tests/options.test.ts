import { Command } from 'commander'
import { describe, expect, test } from 'vitest'

import { parseNonNegativeInt, minFreeDiskMbOption } from '../src/options'

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
  ] as const)('parses %j', (args: readonly string[], expected: number | undefined) => {
    const command = new Command().addOption(minFreeDiskMbOption)
    command.parse([...args], { from: 'user' })
    expect(command.opts().minFreeDiskMb).toBe(expected)
    expect(command.helpInformation()).toContain('--min-free-disk-mb')
    expect(command.helpInformation()).not.toContain('--free-disk-space-mb')
  })
})
