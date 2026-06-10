import { assert, test, describe } from 'vitest'
import { Code, ConnectError } from '@connectrpc/connect'
import { handleRpcError } from '../../src/envd/rpc'
import {
  AuthenticationError,
  InvalidArgumentError,
  NotFoundError,
  RateLimitError,
  SandboxError,
  TimeoutError,
} from '../../src/errors'

describe('handleRpcError', () => {
  test('returns InvalidArgumentError for InvalidArgument', () => {
    const err = handleRpcError(new ConnectError('bad', Code.InvalidArgument))
    assert.instanceOf(err, InvalidArgumentError)
  })

  test('returns AuthenticationError for Unauthenticated', () => {
    const err = handleRpcError(new ConnectError('nope', Code.Unauthenticated))
    assert.instanceOf(err, AuthenticationError)
  })

  test('returns NotFoundError for NotFound', () => {
    const err = handleRpcError(new ConnectError('missing', Code.NotFound))
    assert.instanceOf(err, NotFoundError)
  })

  test('returns RateLimitError for ResourceExhausted', () => {
    const err = handleRpcError(
      new ConnectError('too many', Code.ResourceExhausted)
    )
    assert.instanceOf(err, RateLimitError)
    assert.include(err.message, 'Rate limit')
  })

  test('returns TimeoutError for Unavailable', () => {
    const err = handleRpcError(new ConnectError('gone', Code.Unavailable))
    assert.instanceOf(err, TimeoutError)
  })

  test('falls back to SandboxError for unmapped code', () => {
    const err = handleRpcError(new ConnectError('boom', Code.Internal))
    assert.instanceOf(err, SandboxError)
  })

  test('returns the original error when not a ConnectError', () => {
    const original = new Error('not connect')
    const err = handleRpcError(original)
    assert.strictEqual(err, original)
  })
})
