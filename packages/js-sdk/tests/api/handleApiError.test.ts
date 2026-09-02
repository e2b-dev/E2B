import { afterEach, assert, test, describe } from 'vitest'
import { handleApiError } from '../../src/api'
import {
  AuthenticationError,
  RateLimitError,
  SandboxError,
} from '../../src/errors'

const originalRequestSource = process.env.E2B_USER_AGENT_SOURCE

afterEach(() => {
  if (originalRequestSource === undefined) {
    delete process.env.E2B_USER_AGENT_SOURCE
  } else {
    process.env.E2B_USER_AGENT_SOURCE = originalRequestSource
  }
})

function createMockResponse(
  status: number,
  error: unknown,
  data?: unknown,
  headers: Headers = new Headers()
): {
  response: {
    status: number
    statusText: string
    ok: boolean
    headers: Headers
  }
  error: unknown
  data: unknown
} {
  return {
    response: {
      status,
      statusText: '',
      ok: status >= 200 && status < 300,
      headers,
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

  test('does not change failed response errors in CI', () => {
    process.env.E2B_USER_AGENT_SOURCE = 'ci'
    const res = createMockResponse(
      500,
      { message: 'Internal error' },
      undefined,
      new Headers({ 'X-E2B-Trace-ID': 'trace-123' })
    )

    const err = handleApiError(res as any)

    assert.equal(err?.message, '500: Internal error')
  })

  test('does not change failed response errors outside CI', () => {
    delete process.env.E2B_USER_AGENT_SOURCE
    const res = createMockResponse(
      500,
      { message: 'Internal error' },
      undefined,
      new Headers({ 'X-E2B-Trace-ID': 'trace-123' })
    )

    const err = handleApiError(res as any)

    assert.equal(err?.message, '500: Internal error')
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
