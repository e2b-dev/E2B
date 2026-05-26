import { assert, describe, test } from 'vitest'
import { handleEnvdApiError } from '../../src/envd/api'
import { RateLimitError } from '../../src/errors'

describe('handleEnvdApiError', () => {
  test('preserves Retry-After on 429', async () => {
    const err = await handleEnvdApiError({
      error: { message: 'too many requests' },
      response: new Response('', {
        status: 429,
        headers: { 'Retry-After': '45' },
      }),
    })

    assert.instanceOf(err, RateLimitError)
    assert.equal((err as RateLimitError).retryAfter, 45)
    assert.equal((err as RateLimitError).retryAfterHeader, '45')
    assert.include(err?.message, 'Retry after 45 seconds')
  })
})
