import { describe, expect, test, vi } from 'vitest'

import {
  parseRetryAfter,
  resolveRetries,
  withRateLimitRetry,
} from '../src/retry'

describe('resolveRetries', () => {
  test('defaults to zero', () => {
    expect(resolveRetries()).toBe(0)
  })

  test.each([-1, 1.5, Number.NaN])('rejects %s', (retries) => {
    expect(() => resolveRetries(retries)).toThrow(
      'expected a non-negative integer'
    )
  })
})

describe('parseRetryAfter', () => {
  test.each([
    ['0', 0],
    [' 12 ', 12],
    ['2147483', 2_147_483],
    [null, undefined],
    ['', undefined],
    ['-1', undefined],
    ['1.5', undefined],
    ['Wed, 21 Oct 2015 07:28:00 GMT', undefined],
    ['2147484', undefined],
  ])('parses %j as %s', (value, expected) => {
    expect(parseRetryAfter(value)).toBe(expected)
  })
})

test('retries a buffered request and cancels the intermediate response', async () => {
  const bodies: string[] = []
  const rateLimited = new Response('rate limited', {
    status: 429,
    headers: { 'Retry-After': '2' },
  })
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    bodies.push(await (input as Request).text())
    return bodies.length === 1 ? rateLimited : new Response('ok')
  }) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRateLimitRetry(fetchImpl, 1, 10_000, {
    monotonic: () => 0,
    sleep,
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource', {
    method: 'POST',
    body: 'request body',
  })

  expect(await response.text()).toBe('ok')
  expect(bodies).toEqual(['request body', 'request body'])
  expect(sleep).toHaveBeenCalledWith(2_000, expect.any(AbortSignal))
  expect(rateLimited.bodyUsed).toBe(true)
})

test('returns the final 429 after exhausting retries', async () => {
  const fetchImpl = vi.fn(async () => {
    return new Response(null, {
      status: 429,
      headers: { 'Retry-After': '0' },
    })
  }) as typeof fetch
  const fetchWithRetry = withRateLimitRetry(fetchImpl, 2, 10_000, {
    monotonic: () => 0,
    sleep: async () => {},
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource')

  expect(response.status).toBe(429)
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})

test('propagates 429 when Retry-After exceeds the request timeout', async () => {
  const fetchImpl = vi.fn(async () => {
    return new Response(null, {
      status: 429,
      headers: { 'Retry-After': '2' },
    })
  }) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRateLimitRetry(fetchImpl, 1, 1_000, {
    monotonic: () => 0,
    sleep,
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource')

  expect(response.status).toBe(429)
  expect(fetchImpl).toHaveBeenCalledOnce()
  expect(sleep).not.toHaveBeenCalled()
})

test('propagates 429 without Retry-After as is', async () => {
  const rateLimited = new Response('rate limited', { status: 429 })
  const fetchImpl = vi.fn(async () => rateLimited) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRateLimitRetry(fetchImpl, 2, 10_000, {
    monotonic: () => 0,
    sleep,
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource')

  expect(response).toBe(rateLimited)
  expect(response.bodyUsed).toBe(false)
  expect(fetchImpl).toHaveBeenCalledOnce()
  expect(sleep).not.toHaveBeenCalled()
})

test('aborting during Retry-After sleep rejects promptly', async () => {
  const rateLimited = new Response('rate limited', {
    status: 429,
    headers: { 'Retry-After': '1' },
  })
  const fetchImpl = vi.fn(async () => rateLimited) as typeof fetch
  const fetchWithRetry = withRateLimitRetry(fetchImpl, 1, 10_000)
  const controller = new AbortController()
  const reason = new Error('cancelled')

  const response = fetchWithRetry('https://api.e2b.test/resource', {
    signal: controller.signal,
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  controller.abort(reason)

  await expect(response).rejects.toBe(reason)
  expect(rateLimited.bodyUsed).toBe(true)
  expect(fetchImpl).toHaveBeenCalledOnce()
})

test('disabled retries pass a streaming request through unchanged', async () => {
  const fetchImpl = vi.fn(async () => new Response('ok')) as typeof fetch
  const fetchWithRetry = withRateLimitRetry(fetchImpl, 0, 10_000)
  const body = new ReadableStream()
  const init = {
    method: 'POST',
    body,
    duplex: 'half' as const,
  }

  await fetchWithRetry('https://api.e2b.test/resource', init)

  expect(fetchImpl).toHaveBeenCalledWith('https://api.e2b.test/resource', init)
  expect(body.locked).toBe(false)
})
