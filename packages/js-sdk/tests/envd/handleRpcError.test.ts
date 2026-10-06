import { assert, test, describe } from 'vitest'
import { Code, ConnectError } from '@connectrpc/connect'
import {
  handleRpcError,
  handleRpcErrorWithHealthCheck,
  isTransportFailure,
  rejectProxyUnavailableResponse,
} from '../../src/envd/rpc'
import {
  handleProcessStartEvent,
  handleWatchDirStartEvent,
} from '../../src/envd/api'
import {
  AuthenticationError,
  InvalidArgumentError,
  NotFoundError,
  RateLimitError,
  SandboxError,
  SandboxUnreachableError,
  SandboxNotFoundError,
  TimeoutError,
} from '../../src/errors'

// connect wraps a `fetch` rejection as `Code.Unknown` with the failure as `cause`
function connectRefused(): ConnectError {
  const cause = Object.assign(new TypeError('fetch failed'), {
    cause: Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    }),
  })
  return new ConnectError(
    cause.message,
    Code.Unknown,
    undefined,
    undefined,
    cause
  )
}

// Body of the proxy's 502 when the sandbox is running but nothing listens on envd's port
const PORT_CLOSED = 'The sandbox is running but port is not open'

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

  test('returns SandboxUnreachableError for Unavailable with the sandbox running but its port closed', () => {
    const err = handleRpcError(new ConnectError(PORT_CLOSED, Code.Unavailable))
    assert.instanceOf(err, SandboxUnreachableError)
    assert.include(err.message, 'envd inside the sandbox could not be reached')
  })

  test('returns SandboxNotFoundError for Unavailable with the sandbox not found', () => {
    const err = handleRpcError(
      new ConnectError('The sandbox was not found', Code.Unavailable)
    )
    assert.instanceOf(err, SandboxNotFoundError)
    assert.include(err.message, 'The sandbox was not found')
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
    assert.include(err.message, 'terminated')
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

  // Each JS runtime surfaces a dropped connection with different wording
  const runtimeTerminatedMessages = {
    Node: 'terminated',
    Bun: 'The socket connection was closed unexpectedly',
    Deno: 'error reading a body from connection',
    'Cloudflare Workers': 'Network connection lost.',
    Browser: 'network error',
  }

  test('returns a SandboxNotFoundError when the health check says the sandbox is not running', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      terminated(),
      async () => false
    )
    assert.instanceOf(err, SandboxNotFoundError)
    assert.include(err.message, 'sandbox was killed or reached its end of life')
  })

  for (const [runtime, message] of Object.entries(runtimeTerminatedMessages)) {
    test(`treats the ${runtime} dropped-connection message as terminated`, async () => {
      const err = await handleRpcErrorWithHealthCheck(
        new ConnectError(message, Code.Unknown),
        async () => false
      )
      assert.instanceOf(err, SandboxNotFoundError)
      assert.include(
        err.message,
        'sandbox was killed or reached its end of life'
      )
    })
  }

  test('falls back to the generic mapping when the health check says the sandbox is running', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      terminated(),
      async () => true
    )
    assert.instanceOf(err, SandboxError)
    assert.notInstanceOf(err, TimeoutError)
    assert.notInclude(err.message, 'killed')
  })

  test('falls back to the generic mapping when the sandbox state is unknown', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      terminated(),
      async () => undefined
    )
    assert.instanceOf(err, SandboxError)
    assert.notInstanceOf(err, TimeoutError)
    assert.notInclude(err.message, 'killed')
  })

  test('keeps the probe SandboxUnreachableError with the failed request as cause', async () => {
    const original = terminated()
    const probeErr = new SandboxUnreachableError(PORT_CLOSED)
    const err = await handleRpcErrorWithHealthCheck(original, async () => {
      throw probeErr
    })
    assert.strictEqual(err, probeErr)
    assert.strictEqual(err.cause, original)
  })

  test('returns a SandboxUnreachableError when the health check itself fails', async () => {
    const original = terminated()
    const err = await handleRpcErrorWithHealthCheck(original, async () => {
      throw new Error('health check failed')
    })
    assert.instanceOf(err, SandboxUnreachableError)
    assert.include(err.message, 'could not be reached')
    assert.strictEqual(err.cause, original)
  })

  test.each([
    ['Chrome', 'Failed to fetch'],
    ['Firefox', 'NetworkError when attempting to fetch resource.'],
    ['Safari', 'Load failed'],
  ])(
    "treats %s's opaque network error as a transport failure",
    async (_, message) => {
      const cause = new TypeError(message)
      const err = new ConnectError(
        message,
        Code.Unknown,
        undefined,
        undefined,
        cause
      )
      assert.isTrue(isTransportFailure(err))

      const resolved = await handleRpcErrorWithHealthCheck(err, async () => {
        throw new TypeError(message)
      })
      assert.instanceOf(resolved, SandboxUnreachableError)
      assert.strictEqual(resolved.cause, err)
    }
  )

  test('treats a refused connection as a transport failure', () => {
    assert.isTrue(isTransportFailure(connectRefused()))
    assert.isFalse(isTransportFailure(new ConnectError('nope', Code.NotFound)))
    assert.isFalse(
      isTransportFailure(
        new ConnectError(
          'boom',
          Code.Unknown,
          undefined,
          undefined,
          new Error('boom')
        )
      )
    )
  })

  test('runs the health check when the connection could not be established', async () => {
    let called = false
    const original = connectRefused()
    const err = await handleRpcErrorWithHealthCheck(original, async () => {
      called = true
      return true
    })
    assert.isTrue(called)
    assert.instanceOf(err, SandboxError)
    assert.notInstanceOf(err, TimeoutError)
    assert.notInstanceOf(err, SandboxUnreachableError)
  })

  test('returns a SandboxNotFoundError for a refused connection when the sandbox is gone', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      connectRefused(),
      async () => false
    )
    assert.instanceOf(err, SandboxNotFoundError)
  })

  test('returns a SandboxUnreachableError for a refused connection when the probe gets no answer', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      connectRefused(),
      async () => {
        throw new TypeError('fetch failed')
      }
    )
    assert.instanceOf(err, SandboxUnreachableError)
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

describe('start event handlers', () => {
  async function* failing(): AsyncGenerator<never> {
    throw new ConnectError('port is not open', Code.Unavailable)
  }

  test('handleProcessStartEvent rethrows the ConnectError so the caller maps it', async () => {
    await handleProcessStartEvent(failing()).then(
      () => assert.fail('expected rejection'),
      (err) => {
        assert.instanceOf(err, ConnectError)
        assert.equal(err.code, Code.Unavailable)
        assert.instanceOf(handleRpcError(err), TimeoutError)
      }
    )
  })

  test('handleWatchDirStartEvent rethrows the ConnectError so the caller maps it', async () => {
    await handleWatchDirStartEvent(failing()).then(
      () => assert.fail('expected rejection'),
      (err) => {
        assert.instanceOf(err, ConnectError)
        assert.equal(err.code, Code.Unavailable)
        assert.instanceOf(handleRpcError(err), TimeoutError)
      }
    )
  })
})

describe('rejectProxyUnavailableResponse', () => {
  test('passes other responses through', async () => {
    const res = new Response('ok', { status: 200 })
    assert.strictEqual(await rejectProxyUnavailableResponse(res), res)
  })

  test('rejects a proxy 502 as Unavailable with the body message', async () => {
    const res = new Response(
      JSON.stringify({ message: PORT_CLOSED, port: 49983, code: 502 }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
    try {
      await rejectProxyUnavailableResponse(res)
      assert.fail('expected a rejection')
    } catch (err) {
      assert.instanceOf(err, ConnectError)
      assert.strictEqual((err as ConnectError).code, Code.Unavailable)
      assert.strictEqual((err as ConnectError).rawMessage, PORT_CLOSED)
    }
  })

  test('falls back to the status for a 502 without a JSON body', async () => {
    const res = new Response('bad gateway', { status: 502 })
    try {
      await rejectProxyUnavailableResponse(res)
      assert.fail('expected a rejection')
    } catch (err) {
      assert.instanceOf(err, ConnectError)
      assert.strictEqual((err as ConnectError).rawMessage, 'HTTP 502')
    }
  })
})
