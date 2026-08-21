import { assert, test, describe, vi, afterEach } from 'vitest'
import { ApiClient } from '../../src/api'
import { ConnectionConfig } from '../../src/connectionConfig'
import { AuthenticationError } from '../../src/errors'

describe('ApiClient API key requirement', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('throws when no API key is supplied', () => {
    vi.stubEnv('E2B_API_KEY', '')
    const config = new ConnectionConfig({})
    assert.throws(
      () => new ApiClient(config),
      AuthenticationError,
      /API key is required/
    )
  })

  test('does not require an API key when requireApiKey is false', () => {
    vi.stubEnv('E2B_API_KEY', '')
    const config = new ConnectionConfig({})
    assert.doesNotThrow(() => new ApiClient(config, { requireApiKey: false }))
  })

  test('accepts any non-empty key without format checks', () => {
    const config = new ConnectionConfig({ apiKey: 'not-a-standard-key' })
    assert.doesNotThrow(() => new ApiClient(config))
  })

  test('deprecated validateApiKey option has no effect', () => {
    const config = new ConnectionConfig({
      apiKey: 'not-a-standard-key',
      validateApiKey: true,
    })
    assert.doesNotThrow(() => new ApiClient(config))
  })
})
