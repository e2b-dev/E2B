import { InvalidArgumentError } from '@commander-js/extra-typings'
import { describe, expect, test } from 'vitest'

import { parseSandboxStates } from '../../../src/commands/sandbox/utils'

describe('parseSandboxStates', () => {
  test('parses a comma-separated list of states', () => {
    expect(parseSandboxStates('running')).toEqual(['running'])
    expect(parseSandboxStates('running, paused')).toEqual(['running', 'paused'])
  })

  test('rejects unknown states', () => {
    expect(() => parseSandboxStates('running,stopped')).toThrow(
      InvalidArgumentError
    )
    expect(() => parseSandboxStates('running,')).toThrow(InvalidArgumentError)
  })
})
