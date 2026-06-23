import { assert, test, describe, vi, afterEach } from 'vitest'
import { ApiClient, validateApiKey } from '../../src/api'
import { ConnectionConfig } from '../../src/connectionConfig'
import { AuthenticationError } from '../../src/errors'

describe('validateApiKey', () => {
  const validKey = 'e2b_' + '0123456789abcdef'.repeat(2) + '01234567'

  test('accepts a well-formed key', () => {
    assert.doesNotThrow(() => validateApiKey(validKey))
  })

  test('rejects a key without the e2b_ prefix', () => {
    assert.throws(
      () => validateApiKey('sk_' + '0'.repeat(40)),
      AuthenticationError,
      /Invalid API key format/
    )
  })

  test('accepts a key with a non-default body length', () => {
    assert.doesNotThrow(() => validateApiKey('e2b_' + '0'.repeat(20)))
  })

  test('rejects an empty body after the prefix', () => {
    assert.throws(
      () => validateApiKey('e2b_'),
      AuthenticationError,
      /Invalid API key format/
    )
  })

  test('rejects a key with non-hex characters in the body', () => {
    assert.throws(
      () => validateApiKey('e2b_' + 'z'.repeat(40)),
      AuthenticationError,
      /Invalid API key format/
    )
  })

  test('error message includes an example token', () => {
    try {
      validateApiKey('nope')
      assert.fail('expected validateApiKey to throw')
    } catch (err) {
      assert.instanceOf(err, AuthenticationError)
      assert.match(
        (err as Error).message,
        /e2b_0{40}/,
        'expected example token in error message'
      )
    }
  })
})

describe('ApiClient API key validation', () => {
  test('throws on a malformed key by default', () => {
    const config = new ConnectionConfig({ apiKey: 'not-a-valid-key' })
    assert.throws(() => new ApiClient(config), AuthenticationError)
  })

  test('skips validation when validateApiKey is false', () => {
    const config = new ConnectionConfig({
      apiKey: 'not-a-valid-key',
      validateApiKey: false,
    })
    assert.doesNotThrow(() => new ApiClient(config))
  })
})

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
})
