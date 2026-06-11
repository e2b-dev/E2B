import { assert, test, describe } from 'vitest'
import { Code, ConnectError } from '@connectrpc/connect'
import {
  handleRpcError,
  handleRpcErrorWithHealthCheck,
} from '../../src/envd/rpc'
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

  test('falls back to generic SandboxError for Unknown "terminated"', () => {
    const err = handleRpcError(new ConnectError('terminated', Code.Unknown))
    assert.instanceOf(err, SandboxError)
    assert.include(err.message, 'The connection to the sandbox was terminated')
    assert.notInclude(err.message, 'killed')
  })

  test('returns the original error when not a ConnectError', () => {
    const original = new Error('not connect')
    const err = handleRpcError(original)
    assert.strictEqual(err, original)
  })
})

describe('handleRpcErrorWithHealthCheck', () => {
  const terminated = () => new ConnectError('terminated', Code.Unknown)

  test('reports the sandbox as killed when the health check says it is not running', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      terminated(),
      async () => false
    )
    assert.instanceOf(err, SandboxError)
    assert.include(err.message, 'sandbox was killed or reached its end of life')
    assert.notInclude(err.message, 'transient')
  })

  test('falls back to a generic SandboxError when the health check says the sandbox is running', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      terminated(),
      async () => true
    )
    assert.instanceOf(err, SandboxError)
    assert.include(err.message, 'The connection to the sandbox was terminated')
    assert.notInclude(err.message, 'killed')
  })

  test('falls back to a generic SandboxError when the sandbox state is unknown', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      terminated(),
      async () => undefined
    )
    assert.instanceOf(err, SandboxError)
    assert.include(err.message, 'The connection to the sandbox was terminated')
    assert.notInclude(err.message, 'killed')
  })

  test('falls back to a generic SandboxError when the health check itself fails', async () => {
    const err = await handleRpcErrorWithHealthCheck(terminated(), async () => {
      throw new Error('health check failed')
    })
    assert.instanceOf(err, SandboxError)
    assert.include(err.message, 'The connection to the sandbox was terminated')
    assert.notInclude(err.message, 'killed')
  })

  test('does not run the health check for other errors', async () => {
    let called = false
    const err = await handleRpcErrorWithHealthCheck(
      new ConnectError('missing', Code.NotFound),
      async () => {
        called = true
        return false
      }
    )
    assert.instanceOf(err, NotFoundError)
    assert.isFalse(called)
  })
})
