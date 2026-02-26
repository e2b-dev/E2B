import { describe, expect, test } from 'vitest'

import { handleE2BRequestError, E2BRequestError } from '../../src/utils/errors'

describe('handleE2BRequestError', () => {
  test('does not throw when there is no error', () => {
    const res = { data: { id: '123' } }
    expect(() => handleE2BRequestError(res)).not.toThrow()
  })

  test('throws E2BRequestError for known status codes', () => {
    const res = { error: { code: 401, message: 'invalid token' } }
    expect(() => handleE2BRequestError(res, 'Auth failed')).toThrow(
      E2BRequestError
    )
    expect(() => handleE2BRequestError(res, 'Auth failed')).toThrow(
      'Auth failed: [401] unauthorized: invalid token'
    )
  })

  test('throws E2BRequestError with message for status code 0', () => {
    const res = { error: { code: 0, message: 'connection reset' } }
    expect(() => handleE2BRequestError(res, 'Request failed')).toThrow(
      E2BRequestError
    )
    expect(() => handleE2BRequestError(res, 'Request failed')).toThrow(
      'Request failed: [0] unknown error: connection reset'
    )
  })

  test('throws E2BRequestError when error code is missing', () => {
    const res = { error: { message: 'something went wrong' } } as any
    expect(() => handleE2BRequestError(res, 'Request failed')).toThrow(
      E2BRequestError
    )
    expect(() => handleE2BRequestError(res, 'Request failed')).toThrow(
      'Request failed: [0] unknown error: something went wrong'
    )
  })

  test('handles valid but unlisted HTTP status codes via statuses package', () => {
    const res = { error: { code: 502, message: 'upstream down' } }
    expect(() => handleE2BRequestError(res)).toThrow(E2BRequestError)
    expect(() => handleE2BRequestError(res)).toThrow(
      '[502] Bad Gateway: upstream down'
    )
  })
})
