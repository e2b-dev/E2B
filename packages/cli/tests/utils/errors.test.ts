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

  test('appends the trace ID from X-Trace-ID to the message', () => {
    const res = {
      error: { code: 500, message: 'internal error' },
      response: { headers: new Headers({ 'X-Trace-ID': 'abc123' }) },
    }
    expect(() => handleE2BRequestError(res, 'Request failed')).toThrow(
      'Request failed: [500] internal server error: internal error (trace ID: abc123)'
    )
  })

  test('appends the trace ID from the GCP edge header', () => {
    const res = {
      error: { code: 500, message: 'internal error' },
      response: {
        headers: new Headers({
          'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1',
        }),
      },
    }
    expect(() => handleE2BRequestError(res)).toThrow(
      '(trace ID: 105445aa7843bc8bf206b12000100000)'
    )
  })

  test('normalizes the AWS edge header to the 32-hex trace ID', () => {
    const res = {
      error: { code: 500, message: 'internal error' },
      response: {
        headers: new Headers({
          'X-Amzn-Trace-Id': 'Root=1-5759e988-bd862e3fe1be46a994272793;Sampled=1',
        }),
      },
    }
    expect(() => handleE2BRequestError(res)).toThrow(
      '(trace ID: 5759e988bd862e3fe1be46a994272793)'
    )
  })

  test('falls back to the raw Root value for an unexpected AWS format', () => {
    const res = {
      error: { code: 500, message: 'internal error' },
      response: {
        headers: new Headers({ 'X-Amzn-Trace-Id': 'Root=custom-value' }),
      },
    }
    expect(() => handleE2BRequestError(res)).toThrow(
      '(trace ID: custom-value)'
    )
  })

  test('prefers X-Trace-ID over the cloud edge headers', () => {
    const res = {
      error: { code: 500, message: 'internal error' },
      response: {
        headers: new Headers({
          'X-Trace-ID': 'explicit',
          'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1',
          'X-Amzn-Trace-Id': 'Root=1-5759e988-bd862e3fe1be46a994272793',
        }),
      },
    }
    expect(() => handleE2BRequestError(res)).toThrow('(trace ID: explicit)')
  })

  test('leaves the message unchanged without trace headers', () => {
    const res = {
      error: { code: 500, message: 'internal error' },
      response: { headers: new Headers() },
    }
    expect(() => handleE2BRequestError(res, 'Request failed')).toThrow(
      'Request failed: [500] internal server error: internal error'
    )
    expect(() => handleE2BRequestError(res, 'Request failed')).not.toThrow(
      'trace ID'
    )
  })
})
