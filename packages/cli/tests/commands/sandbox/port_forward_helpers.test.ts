import { describe, expect, test } from 'vitest'
import * as commander from '@commander-js/extra-typings'

import {
  collectPortMapping,
  parsePortMapping,
  parseTunnelMarker,
  randomTunnelPath,
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

  test('parsePortMapping reads :remote as a random local port', () => {
    expect(parsePortMapping(':3000')).toEqual({
      localPort: 0,
      remotePort: 3000,
    })
  })

  test.each(['', 'abc', '0', '65536', '80:', ':', ':0', '0:80', '1:2:3', '80.5', '-1'])(
    'parsePortMapping rejects %j',
    (value: string) => {
      expect(() => parsePortMapping(value)).toThrow(
        commander.InvalidArgumentError
      )
    }
  )

  test('collectPortMapping collects every mapping', () => {
    expect(collectPortMapping('5432', collectPortMapping('8000:3000'))).toEqual([
      { localPort: 8000, remotePort: 3000 },
      { localPort: 5432, remotePort: 5432 },
    ])
  })

  test('collectPortMapping allows several random local ports', () => {
    expect(collectPortMapping(':4000', collectPortMapping(':3000'))).toEqual([
      { localPort: 0, remotePort: 3000 },
      { localPort: 0, remotePort: 4000 },
    ])
  })

  test('collectPortMapping rejects a local port given twice', () => {
    expect(() =>
      collectPortMapping('8000:4000', collectPortMapping('8000:3000'))
    ).toThrow(commander.InvalidArgumentError)
  })

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

  test('parseTunnelMarker reads the PID and path of a marker', () => {
    const path = randomTunnelPath()
    expect(parseTunnelMarker(`123 ${path}\n`)).toEqual({ pid: 123, path })
    expect(parseTunnelMarker('')).toBeUndefined()
    expect(parseTunnelMarker('123')).toBeUndefined()
    expect(parseTunnelMarker('abc /s3cret')).toBeUndefined()
  })
})
