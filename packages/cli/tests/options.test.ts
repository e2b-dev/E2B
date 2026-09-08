import { describe, expect, test } from 'vitest'

import { parseNonNegativeInt } from '../src/options'

describe('parseNonNegativeInt', () => {
  test.each(['', '   '])('rejects a blank value', (value: string) => {
    expect(() => parseNonNegativeInt('Value')(value)).toThrow(
      'Value must be a non-negative integer.'
    )
  })

  test('accepts zero', () => {
    expect(parseNonNegativeInt('Value')('0')).toBe(0)
  })
})
