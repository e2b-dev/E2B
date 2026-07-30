import { assert, test, describe } from 'vitest'
import { handleEnvdApiError, handleEnvdApiFetchError } from '../../src/envd/api'
import {
  AuthenticationError,
  InvalidArgumentError,
  NotEnoughSpaceError,
  NotFoundError,
  RateLimitError,
  SandboxError,
  TimeoutError,
} from '../../src/errors'

function createMockResponse(
  status: number,
  error?: { message?: string } | string
): {
  error?: { message?: string } | string
  response: Response
} {
  return {
    error,
    response: {
      status,
      ok: status >= 200 && status < 300,
      statusText: '',
      // openapi-fetch consumes the body whenever it produces an error value
      bodyUsed: error !== undefined,
      text: async () => (typeof error === 'string' ? error : ''),
    } as unknown as Response,
  }
}

describe('handleEnvdApiError', () => {
  test('returns undefined for a successful response', async () => {
    const err = await handleEnvdApiError(createMockResponse(200))
    assert.isUndefined(err)
  })

  test('returns an error for non-2xx response without content', async () => {
    // openapi-fetch leaves `error` undefined for responses with
    // Content-Length: 0
    const res = createMockResponse(500)
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, SandboxError)
    assert.include(err?.message, '500')
  })

  test('returns an error for non-2xx response with empty string error', async () => {
    const res = createMockResponse(500, '')
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, SandboxError)
    assert.include(err?.message, '500')
  })

  test('returns a mapped error for non-2xx response without content', async () => {
    const res = createMockResponse(404)
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, NotFoundError)
  })

  test('returns InvalidArgumentError for 400', async () => {
    const res = createMockResponse(400, { message: 'Bad request' })
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, InvalidArgumentError)
  })

  test('returns AuthenticationError for 401', async () => {
    const res = createMockResponse(401, { message: 'Invalid token' })
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, AuthenticationError)
  })

  test('returns NotFoundError for 404', async () => {
    const res = createMockResponse(404, { message: 'Not found' })
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, NotFoundError)
  })

  test('returns RateLimitError for 429', async () => {
    const res = createMockResponse(429, { message: 'Too many requests' })
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, RateLimitError)
    assert.include(err?.message, 'rate limited')
  })

  test('returns TimeoutError for 502', async () => {
    const res = createMockResponse(502, { message: 'Bad gateway' })
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, TimeoutError)
  })

  test('returns NotEnoughSpaceError for 507', async () => {
    const res = createMockResponse(507, { message: 'No space left' })
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, NotEnoughSpaceError)
  })

  test('falls back to SandboxError for unmapped status', async () => {
    const res = createMockResponse(500, { message: 'Internal error' })
    const err = await handleEnvdApiError(res)
    assert.instanceOf(err, SandboxError)
    assert.include(err?.message, '500')
  })
})

describe('handleEnvdApiFetchError', () => {
  test('returns the original error for terminated fetch without a health check', async () => {
    const original = new TypeError('terminated')
    const err = await handleEnvdApiFetchError(original)
    assert.strictEqual(err, original)
  })

  test('returns a TimeoutError when the health check says the sandbox is not running', async () => {
    const err = await handleEnvdApiFetchError(
      new TypeError('terminated'),
      async () => false
    )
    assert.instanceOf(err, TimeoutError)
    assert.include(err.message, 'sandbox was killed or reached its end of life')
  })

  // Each JS runtime surfaces a dropped connection with different wording, and not
  // always as a TypeError (Bun raises a plain Error), so match by message
  const runtimeTerminatedErrors = {
    Node: new TypeError('terminated'),
    Bun: new Error('The socket connection was closed unexpectedly'),
    Deno: new TypeError('error reading a body from connection'),
    'Cloudflare Workers': new Error('Network connection lost.'),
  }

  for (const [runtime, error] of Object.entries(runtimeTerminatedErrors)) {
    test(`treats the ${runtime} dropped-connection error as terminated`, async () => {
      const err = await handleEnvdApiFetchError(error, async () => false)
      assert.instanceOf(err, TimeoutError)
      assert.include(
        err.message,
        'sandbox was killed or reached its end of life'
      )
    })
  }

  test('returns the original error when the health check says the sandbox is running', async () => {
    const original = new TypeError('terminated')
    const err = await handleEnvdApiFetchError(original, async () => true)
    assert.strictEqual(err, original)
  })

  test('returns the original error for other fetch failures', async () => {
    const original = new TypeError('fetch failed')
    const err = await handleEnvdApiFetchError(original)
    assert.strictEqual(err, original)
  })
})
