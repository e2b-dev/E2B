import { describe, expect, it } from 'vitest'
import * as packageJSON from '../package.json'
import { connectionConfig } from '../src/api'

describe('CLI connection config', () => {
  it('identifies CLI traffic via the integration field', () => {
    expect(connectionConfig.integration).toBe(`e2b-cli/${packageJSON.version}`)
  })

  it('appends the CLI integration to the User-Agent header', () => {
    expect(connectionConfig.headers?.['User-Agent']).toContain(
      `e2b-cli/${packageJSON.version}`
    )
  })
})
