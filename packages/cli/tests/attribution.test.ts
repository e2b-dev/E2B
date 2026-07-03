import { describe, expect, it } from 'vitest'
import * as e2b from 'e2b'
import * as packageJSON from '../package.json'
import { connectionConfig } from '../src/api'

describe('CLI integration attribution', () => {
  it('tags the shared connection config built at import time', () => {
    expect(connectionConfig.headers?.['User-Agent']).toContain(
      `e2b-cli/${packageJSON.version}`
    )
  })

  it('tags configs constructed later (e.g. by auth commands and Sandbox calls)', () => {
    const config = new e2b.ConnectionConfig()
    expect(config.headers?.['User-Agent']).toContain(
      `e2b-cli/${packageJSON.version}`
    )
  })
})
