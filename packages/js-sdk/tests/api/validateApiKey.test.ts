import { assert, test, describe } from 'vitest'
import { ApiClient, validateApiKey } from '../../src/api'
import { ConnectionConfig } from '../../src/connectionConfig'
import { AuthenticationError } from '../../src/errors'

describe('ApiClient key validation', () => {
  test('skips validation when skipApiKeyValidation is true', () => {
    const config = new ConnectionConfig({
      apiKey: 'sk-' + '0'.repeat(40),
      skipApiKeyValidation: true,
    })
    assert.doesNotThrow(() => new ApiClient(config))
  })

  test('rejects non-standard key by default', () => {
    const config = new ConnectionConfig({ apiKey: 'sk-' + '0'.repeat(40) })
    assert.throws(
      () => new ApiClient(config),
      AuthenticationError,
      /Invalid API key format/
    )
  })
})

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
