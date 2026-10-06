import { assert, test, describe } from 'vitest'
import { Code, ConnectError } from '@connectrpc/connect'
import {
  handleRpcError,
  handleRpcErrorWithHealthCheck,
  isAmbiguousUnavailable,
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
  SandboxNotFoundError,
  SandboxNotRunningError,
  SandboxUnreachableError,
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
// envd ends a stream with this Unavailable when the sandbox is killed mid-command
const STREAM_ENDED =
  'the connection to sandbox ended before the stream completed'

function neverProbe(): Promise<boolean | undefined> {
  throw new Error('health check should not run')
}

describe('Unavailable with the sandbox not found', () => {
  test('returns SandboxNotRunningError, not SandboxNotFoundError, from every call', () => {
    const err = handleRpcError(
      new ConnectError('The sandbox was not found', Code.Unavailable)
    )
    assert.instanceOf(err, SandboxNotRunningError)
    assert.notInstanceOf(err, SandboxNotFoundError)
  })
})

describe('ambiguous Unavailable', () => {
  test('is an Unavailable that says neither not found nor port not open', () => {
    assert.isTrue(
      isAmbiguousUnavailable(new ConnectError(STREAM_ENDED, Code.Unavailable))
    )
    assert.isFalse(
      isAmbiguousUnavailable(
        new ConnectError('The sandbox was not found', Code.Unavailable)
      )
    )
    assert.isFalse(
      isAmbiguousUnavailable(new ConnectError(PORT_CLOSED, Code.Unavailable))
    )
    assert.isFalse(
      isAmbiguousUnavailable(new ConnectError(STREAM_ENDED, Code.Unknown))
    )
  })

  test('is probed and returns SandboxNotRunningError when the sandbox is gone', async () => {
    const original = new ConnectError(STREAM_ENDED, Code.Unavailable)
    const err = await handleRpcErrorWithHealthCheck(original, async () => false)
    assert.instanceOf(err, SandboxNotRunningError)
    assert.notInstanceOf(err, SandboxUnreachableError)
    assert.strictEqual(err.cause, original)
  })

  test('returns SandboxUnreachableError with the state unknown when the sandbox is running', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      new ConnectError(STREAM_ENDED, Code.Unavailable),
      async () => true
    )
    assert.instanceOf(err, SandboxUnreachableError)
    assert.notInstanceOf(err, SandboxNotRunningError)
    assert.include(err.message, 'state is unknown')
    assert.notInclude(err.message, 'is running but')
  })

  test('returns SandboxUnreachableError when the probe itself fails', async () => {
    const original = new ConnectError(STREAM_ENDED, Code.Unavailable)
    const err = await handleRpcErrorWithHealthCheck(original, async () => {
      throw new Error('health check failed')
    })
    assert.instanceOf(err, SandboxUnreachableError)
    assert.include(err.message, 'health check failed')
    assert.strictEqual(err.cause, original)
  })

  test('is not probed for the sandbox not found or its port not open', async () => {
    const notFound = await handleRpcErrorWithHealthCheck(
      new ConnectError('The sandbox was not found', Code.Unavailable),
      neverProbe
    )
    assert.instanceOf(notFound, SandboxNotRunningError)
    const portClosed = await handleRpcErrorWithHealthCheck(
      new ConnectError(PORT_CLOSED, Code.Unavailable),
      neverProbe
    )
    assert.instanceOf(portClosed, SandboxUnreachableError)
    assert.include(portClosed.message, 'is running but')
  })
})

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
    assert.include(err.message, 'could not be reached')
  })

  test('returns SandboxNotRunningError for Unavailable with the sandbox not found', () => {
    const err = handleRpcError(
      new ConnectError('The sandbox was not found', Code.Unavailable)
    )
    assert.instanceOf(err, SandboxNotRunningError)
    assert.instanceOf(err, TimeoutError)
    assert.notInstanceOf(err, SandboxUnreachableError)
    assert.include(err.message, 'The sandbox was not found')
  })

  test('returns SandboxUnreachableError, not SandboxNotRunningError, for Unavailable with the port closed', () => {
    const err = handleRpcError(new ConnectError(PORT_CLOSED, Code.Unavailable))
    assert.instanceOf(err, SandboxUnreachableError)
    assert.notInstanceOf(err, SandboxNotRunningError)
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

  test('does not probe health on an Unavailable for the sandbox not found', async () => {
    let probed = false
    const err = await handleRpcErrorWithHealthCheck(
      new ConnectError('The sandbox was not found', Code.Unavailable),
      async () => {
        probed = true
        return true
      }
    )
    assert.isFalse(probed)
    assert.instanceOf(err, SandboxNotRunningError)
  })

  test('returns a SandboxNotRunningError when the health check says the sandbox is not running', async () => {
    const original = terminated()
    const err = await handleRpcErrorWithHealthCheck(original, async () => false)
    assert.instanceOf(err, SandboxNotRunningError)
    assert.instanceOf(err, TimeoutError)
    assert.notInstanceOf(err, SandboxUnreachableError)
    assert.include(err.message, 'sandbox was killed or reached its end of life')
    assert.strictEqual(err.cause, original)
  })

  for (const [runtime, message] of Object.entries(runtimeTerminatedMessages)) {
    test(`treats the ${runtime} dropped-connection message as terminated`, async () => {
      const err = await handleRpcErrorWithHealthCheck(
        new ConnectError(message, Code.Unknown),
        async () => false
      )
      assert.instanceOf(err, SandboxNotRunningError)
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
    assert.include(err.message, 'health check failed')
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

  test('returns a SandboxNotRunningError for a refused connection when the sandbox is gone', async () => {
    const err = await handleRpcErrorWithHealthCheck(
      connectRefused(),
      async () => false
    )
    assert.instanceOf(err, SandboxNotRunningError)
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

  test('passes a Connect-encoded 502 error through for the transport to decode', async () => {
    const body = JSON.stringify({
      code: 'permission_denied',
      message: 'access denied',
    })
    const res = new Response(body, {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
    const out = await rejectProxyUnavailableResponse(res)
    assert.strictEqual(out.status, 502)
    assert.strictEqual(out.headers.get('Content-Type'), 'application/json')
    assert.deepEqual(await out.json(), JSON.parse(body))
  })

  test('rejects a 502 whose string code is not a Connect code as Unavailable with the body message', async () => {
    const res = new Response(
      JSON.stringify({
        code: 'BAD_GATEWAY',
        message: 'The sandbox was not found',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
    try {
      await rejectProxyUnavailableResponse(res)
      assert.fail('expected a rejection')
    } catch (err) {
      assert.instanceOf(err, ConnectError)
      assert.strictEqual((err as ConnectError).code, Code.Unavailable)
      assert.strictEqual(
        (err as ConnectError).rawMessage,
        'The sandbox was not found'
      )
    }
  })

  test('keeps the plain-text body of a 502 as the message', async () => {
    const res = new Response('The sandbox was not found', { status: 502 })
    try {
      await rejectProxyUnavailableResponse(res)
      assert.fail('expected a rejection')
    } catch (err) {
      assert.instanceOf(err, ConnectError)
      assert.strictEqual((err as ConnectError).code, Code.Unavailable)
      assert.strictEqual(
        (err as ConnectError).rawMessage,
        'The sandbox was not found'
      )
      assert.instanceOf(handleRpcError(err), SandboxNotRunningError)
    }
  })

  test('falls back to the status for a 502 without a body', async () => {
    const res = new Response(null, { status: 502 })
    try {
      await rejectProxyUnavailableResponse(res)
      assert.fail('expected a rejection')
    } catch (err) {
      assert.instanceOf(err, ConnectError)
      assert.strictEqual((err as ConnectError).rawMessage, 'HTTP 502')
    }
  })
})
