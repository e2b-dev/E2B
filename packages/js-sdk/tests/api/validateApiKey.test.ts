import { assert, test, describe } from 'vitest'
import { validateApiKey } from '../../src/api'
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

  test('accepts a key with a custom prefix', () => {
    assert.doesNotThrow(() =>
      validateApiKey('myorg_' + '0'.repeat(40), 'myorg_')
    )
  })

  test('rejects a key whose prefix does not match the custom prefix', () => {
    assert.throws(
      () => validateApiKey('e2b_' + '0'.repeat(40), 'myorg_'),
      AuthenticationError,
      /Invalid API key format/
    )
  })

  test('custom prefix appears in the error message and example', () => {
    try {
      validateApiKey('nope', 'myorg_')
      assert.fail('expected validateApiKey to throw')
    } catch (err) {
      assert.instanceOf(err, AuthenticationError)
      assert.match((err as Error).message, /myorg_/)
      assert.match((err as Error).message, /myorg_0{40}/)
    }
  })

  test('escapes regex metacharacters in the prefix', () => {
    assert.doesNotThrow(() =>
      validateApiKey('my.org+' + '0'.repeat(40), 'my.org+')
    )
    assert.throws(
      () => validateApiKey('myXorgY' + '0'.repeat(40), 'my.org+'),
      AuthenticationError
    )
  })
})
