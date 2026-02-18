import { assert, test, describe } from 'vitest'
import { handleApiError } from '../../src/api'
import {
  AuthenticationError,
  RateLimitError,
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
