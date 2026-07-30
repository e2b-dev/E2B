import { describe, expect, test } from 'vitest'

import { parseEnv } from '../../src/utils/env'

describe('parseEnv', () => {
  test('accumulates repeated KEY=VALUE pairs', () => {
    const acc: Record<string, string> = {}
    parseEnv('FOO=bar', acc)
    parseEnv('BAZ=qux', acc)
    expect(acc).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  test('keeps "=" inside the value', () => {
    const acc: Record<string, string> = {}
    parseEnv('TOKEN=a=b=c', acc)
    expect(acc).toEqual({ TOKEN: 'a=b=c' })
  })

  test('ignores entries without a value', () => {
    const acc: Record<string, string> = {}
    parseEnv('NOVALUE', acc)
    expect(acc).toEqual({})
  })

  test('preserves an empty string value', () => {
    const acc: Record<string, string> = {}
    parseEnv('EMPTY=', acc)
    expect(acc).toEqual({ EMPTY: '' })
  })
})
