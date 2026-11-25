import { describe, expect, test } from 'vitest'
import * as commander from '@commander-js/extra-typings'

import {
  parsePortMapping,
  randomTunnelPath,
  tunnelPathOf,
  websocatArgs,
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

  test('websocketPortFor shifts the port by half of 1024-65535', () => {
    expect(websocketPortFor(22)).toBe(32278)
    expect(websocketPortFor(3000)).toBe(35256)
    expect(websocketPortFor(33279)).toBe(65535)
    expect(websocketPortFor(33280)).toBe(1024)
  })

  test('websocketPortFor never returns the remote port or a privileged port', () => {
    for (let port = 1; port <= 65535; port++) {
      const wsPort = websocketPortFor(port)
      expect(wsPort).not.toBe(port)
      expect(wsPort).toBeGreaterThanOrEqual(1024)
      expect(wsPort).toBeLessThanOrEqual(65535)
    }
  })

  test('randomTunnelPath returns a fresh URL-safe path', () => {
    const path = randomTunnelPath()
    expect(path).toMatch(/^\/[A-Za-z0-9_-]{32}$/)
    expect(randomTunnelPath()).not.toBe(path)
  })

  test('tunnelPathOf reads the path of a websocat for the same ports', () => {
    const commandLine = `-l -c exec /tmp/.e2b/websocat --binary --exit-on-eof ${websocatArgs(35256, 3000, '/s3cret')}`
    expect(tunnelPathOf(commandLine, 35256, 3000)).toBe('/s3cret')
    expect(tunnelPathOf(commandLine, 35257, 3001)).toBeUndefined()
    expect(
      tunnelPathOf('-l -c exec websocat ws-l:0.0.0.0:35256 tcp:127.0.0.1:3000', 35256, 3000)
    ).toBeUndefined()
  })
})
