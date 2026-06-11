import { assert, describe, test } from 'vitest'
import { authenticationHeader, streamTimeoutMs } from '../../src/envd/rpc'

describe('streamTimeoutMs', () => {
  test('passes non-zero timeouts through', () => {
    assert.equal(streamTimeoutMs(60_000), 60_000)
  })

  test('maps 0 to undefined so connect-es does not abort immediately', () => {
    assert.equal(streamTimeoutMs(0), undefined)
  })
})

describe('authenticationHeader', () => {
  test('encodes the username as base64', () => {
    const headers = authenticationHeader('0.5.0', 'user')
    assert.equal(
      headers.Authorization,
      `Basic ${Buffer.from('user:').toString('base64')}`
    )
  })
})
