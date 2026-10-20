import { assert, test, describe } from 'vitest'
import { handleApiError } from '../../src/api'
import {
  AuthenticationError,
  RateLimitError,
  SandboxPauseRefusedError,
  ServiceBusyError,
  SandboxError,
} from '../../src/errors'

function createMockResponse(
  status: number,
  error: unknown,
  data?: unknown
): {
  response: { status: number; ok: boolean }
  error: unknown
  data: unknown
} {
  return {
    response: { status, ok: status >= 200 && status < 300 },
    error,
    data,
  }
}

describe('handleApiError', () => {
  describe('without content', () => {
    // openapi-fetch leaves `error` undefined for non-2xx responses with
    // Content-Length: 0
    test('catches 404 with undefined error', () => {
      const res = createMockResponse(404, undefined)
      const err = handleApiError(res as any)
      assert.instanceOf(err, SandboxError)
      assert.include(err?.message, '404')
    })

    test('catches 500 with undefined error', () => {
      const res = createMockResponse(500, undefined)
      const err = handleApiError(res as any)
      assert.instanceOf(err, SandboxError)
      assert.include(err?.message, '500')
    })

    test('returns AuthenticationError for 401 with undefined error', () => {
      const res = createMockResponse(401, undefined)
      const err = handleApiError(res as any)
      assert.instanceOf(err, AuthenticationError)
      assert.include(err?.message, 'Unauthorized')
    })

    test('returns ServiceBusyError for 503 with undefined error', () => {
      const res = createMockResponse(503, undefined)
      const err = handleApiError(res as any)
      assert.instanceOf(err, ServiceBusyError)
      assert.include(err?.message, 'temporarily unavailable')
    })
  })

  describe('status code on the error', () => {
    test('a refused pause is a ServiceBusyError carrying 503 and the API message', () => {
      const res = createMockResponse(503, {
        message: 'node is busy persisting sandbox, please retry',
      })
      const err = handleApiError(res as any) as ServiceBusyError
      assert.instanceOf(err, ServiceBusyError)
      assert.equal(err.statusCode, 503)
      assert.include(err.message, 'node is busy persisting sandbox')
    })

    test('a 503 carrying error_code sandbox_pause_refused is a SandboxPauseRefusedError with the API message, whatever the endpoint', () => {
      const res = createMockResponse(503, {
        code: 503,
        error_code: 'sandbox_pause_refused',
        message:
          "Sandbox 'sbx' cannot be paused right now because its node is busy, please retry",
      })
      const err = handleApiError(res as any) as SandboxPauseRefusedError
      assert.instanceOf(err, SandboxPauseRefusedError)
      assert.instanceOf(err, ServiceBusyError)
      assert.equal(err.statusCode, 503)
      assert.equal(err.errorCode, 'sandbox_pause_refused')
      assert.equal(
        err.message,
        "Sandbox 'sbx' cannot be paused right now because its node is busy, please retry"
      )
    })

    test('a 503 carrying another error_code stays a ServiceBusyError', () => {
      const res = createMockResponse(503, {
        code: 503,
        error_code: 'sandbox_capacity_unavailable',
        message: 'no capacity',
      })
      const err = handleApiError(res as any)
      assert.instanceOf(err, ServiceBusyError)
      assert.notInstanceOf(err, SandboxPauseRefusedError)
    })

    test('a generic failure keeps SandboxError and carries its status', () => {
      const res = createMockResponse(500, { message: 'boom' })
      const err = handleApiError(res as any) as SandboxError
      assert.instanceOf(err, SandboxError)
      assert.equal(err.statusCode, 500)
    })

    test('a 503 is a ServiceBusyError whatever error class the caller asked for', () => {
      class BuildLikeError extends SandboxError {
        constructor(message: string) {
          super(message)
          this.name = 'BuildLikeError'
        }
      }
      const res = createMockResponse(503, { message: 'no capacity' })
      const err = handleApiError(res as any, BuildLikeError)
      assert.instanceOf(err, ServiceBusyError)
    })

    test('RateLimitError carries 429', () => {
      const res = createMockResponse(429, { message: 'slow down' })
      const err = handleApiError(res as any) as SandboxError
      assert.instanceOf(err, RateLimitError)
      assert.equal(err.statusCode, 429)
    })
  })

  describe('with empty error body', () => {
    test('catches 404 with empty string error', () => {
      const res = createMockResponse(404, '')
      const err = handleApiError(res as any)
      assert.instanceOf(err, SandboxError)
      assert.include(err?.message, '404')
    })

    test('catches 400 with empty string error', () => {
      const res = createMockResponse(400, '')
      const err = handleApiError(res as any)
      assert.instanceOf(err, SandboxError)
      assert.include(err?.message, '400')
    })

    test('catches 500 with empty string error', () => {
      const res = createMockResponse(500, '')
      const err = handleApiError(res as any)
      assert.instanceOf(err, SandboxError)
      assert.include(err?.message, '500')
    })
  })

  describe('with JSON error body', () => {
    test('catches 404 with message', () => {
      const res = createMockResponse(404, { code: 404, message: 'Not found' })
      const err = handleApiError(res as any)
      assert.instanceOf(err, SandboxError)
      assert.include(err?.message, 'Not found')
    })

    test('catches 400 with message', () => {
      const res = createMockResponse(400, { code: 400, message: 'Bad request' })
      const err = handleApiError(res as any)
      assert.instanceOf(err, SandboxError)
      assert.include(err?.message, 'Bad request')
    })
  })

  describe('special status codes', () => {
    test('returns AuthenticationError for 401', () => {
      const res = createMockResponse(401, { message: 'Invalid token' })
      const err = handleApiError(res as any)
      assert.instanceOf(err, AuthenticationError)
      assert.include(err?.message, 'Unauthorized')
    })

    test('returns AuthenticationError for 401 with empty body', () => {
      const res = createMockResponse(401, '')
      const err = handleApiError(res as any)
      assert.instanceOf(err, AuthenticationError)
      assert.include(err?.message, 'Unauthorized')
    })

    test('returns RateLimitError for 429', () => {
      const res = createMockResponse(429, { message: 'Too many requests' })
      const err = handleApiError(res as any)
      assert.instanceOf(err, RateLimitError)
      assert.include(err?.message, 'Rate limit')
    })

    test('returns RateLimitError for 429 with empty body', () => {
      const res = createMockResponse(429, '')
      const err = handleApiError(res as any)
      assert.instanceOf(err, RateLimitError)
      assert.include(err?.message, 'Rate limit')
    })
  })

  describe('success responses', () => {
    test('returns undefined for 200 success', () => {
      const res = createMockResponse(200, undefined, { id: '123' })
      const err = handleApiError(res as any)
      assert.isUndefined(err)
    })

    test('returns undefined for 201 success', () => {
      const res = createMockResponse(201, undefined, { id: '123' })
      const err = handleApiError(res as any)
      assert.isUndefined(err)
    })
  })
})
