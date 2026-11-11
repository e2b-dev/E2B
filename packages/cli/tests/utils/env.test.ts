import { InvalidArgumentError } from '@commander-js/extra-typings'
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

  test.each(['NOVALUE', '=value', ''])('rejects %j', (value: string) => {
    expect(() => parseEnv(value)).toThrow(InvalidArgumentError)
  })

  test('preserves an empty string value', () => {
    const acc: Record<string, string> = {}
    parseEnv('EMPTY=', acc)
    expect(acc).toEqual({ EMPTY: '' })
  })

  test('starts a fresh object on the first occurrence', () => {
    expect(parseEnv('FOO=bar', undefined)).toEqual({ FOO: 'bar' })
  })
})
