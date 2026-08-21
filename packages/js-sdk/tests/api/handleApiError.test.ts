import { assert, test, describe } from 'vitest'
import { handleApiError } from '../../src/api'
import {
  AuthenticationError,
  BuildError,
  FileUploadError,
  RateLimitError,
  SandboxError,
} from '../../src/errors'

function createMockResponse(
  status: number,
  error: unknown,
  data?: unknown,
  headers?: Record<string, string>
): {
  response: { status: number; ok: boolean; headers?: Headers }
  error: unknown
  data: unknown
} {
  return {
    response: {
      status,
      ok: status >= 200 && status < 300,
      ...(headers && { headers: new Headers(headers) }),
    },
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

  // `getFileUploadLink` is the one caller that supplies a stack trace, so the
  // classes a template file upload can produce have to apply it
  describe('stack trace', () => {
    const stackTrace = 'Error: boom\n    at userCallSite (/app/index.ts:1:1)'

    test('applies the caller stack trace to the error class', () => {
      const res = createMockResponse(500, { message: 'Internal error' })
      const err = handleApiError(res as any, FileUploadError, { stackTrace })
      assert.instanceOf(err, FileUploadError)
      assert.equal(err?.stack, stackTrace)
    })

    // A bad key or a rate limit belongs to the request, not to the builder step
    // that made it, so these two keep the frame where they were constructed
    test('leaves the caller stack trace off 401 errors', () => {
      const res = createMockResponse(401, { message: 'Invalid token' })
      const err = handleApiError(res as any, FileUploadError, { stackTrace })
      assert.instanceOf(err, AuthenticationError)
      assert.notEqual(err?.stack, stackTrace)
    })

    test('leaves the caller stack trace off 429 errors', () => {
      const res = createMockResponse(429, { message: 'Too many requests' })
      const err = handleApiError(res as any, FileUploadError, { stackTrace })
      assert.instanceOf(err, RateLimitError)
      assert.notEqual(err?.stack, stackTrace)
    })
  })

  describe('trace ID header', () => {
    test('appends the trace ID from X-Trace-ID to the message', () => {
      const res = createMockResponse(
        500,
        { message: 'Internal error' },
        undefined,
        { 'X-Trace-ID': 'abc123' }
      )
      const err = handleApiError(res as any)
      assert.instanceOf(err, SandboxError)
      assert.include(err?.message, '(trace ID: abc123)')
    })

    test('appends the trace ID from the GCP edge header', () => {
      const res = createMockResponse(
        429,
        { message: 'Too many requests' },
        undefined,
        { 'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1' }
      )
      const err = handleApiError(res as any)
      assert.instanceOf(err, RateLimitError)
      assert.include(
        err?.message,
        '(trace ID: 105445aa7843bc8bf206b12000100000)'
      )
    })

    test('appends the trace ID for 401 errors', () => {
      const res = createMockResponse(
        401,
        { message: 'Invalid token' },
        undefined,
        { 'X-Trace-ID': 'abc123' }
      )
      const err = handleApiError(res as any)
      assert.instanceOf(err, AuthenticationError)
      assert.include(err?.message, '(trace ID: abc123)')
    })

    test('leaves the message unchanged without trace headers', () => {
      const res = createMockResponse(500, { message: 'Internal error' })
      const err = handleApiError(res as any)
      assert.notInclude(err?.message, 'trace ID')
    })

    test('passes the trace ID through a custom error class', () => {
      const res = createMockResponse(
        500,
        { message: 'Build failed' },
        undefined,
        { 'X-Trace-ID': 'abc123' }
      )
      const err = handleApiError(res as any, BuildError)
      assert.instanceOf(err, BuildError)
      assert.include(err?.message, '(trace ID: abc123)')
    })

    test('exposes the trace ID on the error', () => {
      const res = createMockResponse(
        500,
        { message: 'Internal error' },
        undefined,
        { 'X-Trace-ID': 'abc123' }
      )
      const err = handleApiError(res as any)
      assert.equal((err as SandboxError).traceId, 'abc123')
    })

    test('leaves the trace ID undefined without trace headers', () => {
      const res = createMockResponse(500, { message: 'Internal error' })
      const err = handleApiError(res as any)
      assert.isUndefined((err as SandboxError).traceId)
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
