import { assert, describe, test } from 'vitest'
import { handleEnvdApiError } from '../../src/envd/api'
import { RateLimitError } from '../../src/errors'

describe('handleEnvdApiError', () => {
  test('preserves Retry-After for 429 rate limits', async () => {
    const err = await handleEnvdApiError({
      error: { message: 'Too many requests' },
      response: new Response('', {
        status: 429,
        headers: { 'Retry-After': '60' },
      }),
    })

    assert.instanceOf(err, RateLimitError)
    assert.equal((err as any).retryAfter, 60)
  })

  test('handles 429 rate limits with empty error body', async () => {
    const err = await handleEnvdApiError({
      error: '',
      response: new Response('Too many requests', {
        status: 429,
        headers: { 'Retry-After': '60' },
      }),
    })

    assert.instanceOf(err, RateLimitError)
    assert.equal((err as any).retryAfter, 60)
  })
})
