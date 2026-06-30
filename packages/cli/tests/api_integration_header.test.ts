import { describe, expect, it } from 'vitest'
import * as packageJSON from '../package.json'
import {
  CLI_INTEGRATION,
  connectionConfig,
  withCliIntegration,
} from '../src/api'

describe('CLI connection config', () => {
  it('exposes the CLI integration identifier', () => {
    expect(CLI_INTEGRATION).toBe(`e2b-cli/${packageJSON.version}`)
  })

  it('identifies CLI traffic via the integration field', () => {
    expect(connectionConfig.integration).toBe(CLI_INTEGRATION)
  })

  it('appends the CLI integration to the User-Agent header', () => {
    expect(connectionConfig.headers?.['User-Agent']).toContain(CLI_INTEGRATION)
  })
})

describe('withCliIntegration', () => {
  it('tags SDK call options with the CLI integration', () => {
    expect(withCliIntegration({ apiKey: 'e2b_test' })).toEqual({
      apiKey: 'e2b_test',
      integration: CLI_INTEGRATION,
    })
  })

  it('preserves existing options and works without any', () => {
    expect(withCliIntegration()).toEqual({ integration: CLI_INTEGRATION })
    expect(
      withCliIntegration({ apiKey: 'e2b_test', query: { state: ['running'] } })
    ).toMatchObject({
      apiKey: 'e2b_test',
      query: { state: ['running'] },
      integration: CLI_INTEGRATION,
    })
  })
})
