import { describe, expect, test } from 'vitest'
import * as commander from '@commander-js/extra-typings'

import {
  parsePortMapping,
  websocketPortFor,
} from '../../../src/commands/sandbox/port_forward_helpers'

describe('port-forward helpers', () => {
  test('parsePortMapping reads local:remote', () => {
    expect(parsePortMapping('8000:3000')).toEqual({
      localPort: 8000,
      remotePort: 3000,
    })
  })

  test('parsePortMapping uses a single port for both sides', () => {
    expect(parsePortMapping('5432')).toEqual({
      localPort: 5432,
      remotePort: 5432,
    })
  })

  test.each(['', 'abc', '0', '65536', '80:', ':80', '1:2:3', '80.5', '-1'])(
    'parsePortMapping rejects %j',
    (value: string) => {
      expect(() => parsePortMapping(value)).toThrow(
        commander.InvalidArgumentError
      )
    }
  )

  test('websocketPortFor prefixes the remote port with 80 when it fits', () => {
    expect(websocketPortFor(22)).toBe(8022)
    expect(websocketPortFor(99)).toBe(8099)
  })

  test('websocketPortFor maps larger ports into 50000-59999', () => {
    expect(websocketPortFor(100)).toBe(50100)
    expect(websocketPortFor(3000)).toBe(53000)
    expect(websocketPortFor(65535)).toBe(55535)
  })
})
