import { assert, test, describe } from 'vitest'
import { handleEnvdApiError } from '../../src/envd/api'
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
  error: { message?: string } | string
): {
  error: { message?: string } | string
  response: Response
} {
  return {
    error,
    response: {
      status,
      text: async () => (typeof error === 'string' ? error : ''),
    } as Response,
  }
}

describe('handleEnvdApiError', () => {
  test('returns undefined for a successful response', async () => {
    const err = await handleEnvdApiError({
      response: { status: 200 } as Response,
    })
    assert.isUndefined(err)
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
