import { assert, test, describe, beforeEach, afterEach, vi } from 'vitest'
import {
  parseRetryAfter,
  computeDelayMs,
  resolveMaxRetries,
  retryableErrorKind,
  withRetry,
} from '../src/retry'

const policy = { retries: 3, backoffBaseMs: 500, backoffCapMs: 8_000 }

/**
 * Build a fake `fetch` that returns/throws the queued outcomes in order and
 * records the requests it received.
 */
function fakeFetch(
  outcomes: Array<Response | Error | (() => Response | Error)>
): {
  fetch: typeof fetch
  calls: Request[]
} {
  const calls: Request[] = []
  let i = 0
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init)
    calls.push(req)
    let outcome = outcomes[Math.min(i, outcomes.length - 1)]
    i++
    if (typeof outcome === 'function') outcome = outcome()
    if (outcome instanceof Error) throw outcome
    return outcome
  }) as typeof fetch
  return { fetch: fn, calls }
}

function err(code: string): Error {
  const e = new Error(code) as Error & { code?: string }
  e.code = code
  return e
}

describe('parseRetryAfter', () => {
  test('parses delta-seconds', () => {
    assert.equal(parseRetryAfter('2'), 2000)
    assert.equal(parseRetryAfter('0'), 0)
  })

  test('parses HTTP-date', () => {
    const now = Date.parse('2020-01-01T00:00:00Z')
    const date = new Date(now + 5000).toUTCString()
    assert.equal(parseRetryAfter(date, now), 5000)
  })

  test('returns undefined for missing/garbage', () => {
    assert.equal(parseRetryAfter(null), undefined)
    assert.equal(parseRetryAfter('soon'), undefined)
  })
})

describe('computeDelayMs', () => {
  test('honors Retry-After over backoff', () => {
    const res = new Response(null, {
      status: 429,
      headers: { 'retry-after': '2' },
    })
    assert.equal(computeDelayMs(0, policy, res), 2000)
  })

  test('exponential backoff with full jitter stays within bounds', () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const d = computeDelayMs(attempt, policy)
      const exp = Math.min(
        policy.backoffCapMs,
        policy.backoffBaseMs * 2 ** attempt
      )
      assert.ok(d >= 0 && d <= exp, `attempt ${attempt}: ${d} <= ${exp}`)
    }
  })
})

describe('resolveMaxRetries', () => {
  let original: string | undefined
  beforeEach(() => {
    original = process.env.E2B_MAX_RETRIES
  })
  afterEach(() => {
    if (original === undefined) delete process.env.E2B_MAX_RETRIES
    else process.env.E2B_MAX_RETRIES = original
  })

  test('explicit value wins', () => {
    assert.equal(resolveMaxRetries(5), 5)
    assert.equal(resolveMaxRetries(0), 0)
  })

  test('falls back to env then default', () => {
    delete process.env.E2B_MAX_RETRIES
    assert.equal(resolveMaxRetries(), 3)
    process.env.E2B_MAX_RETRIES = '7'
    assert.equal(resolveMaxRetries(), 7)
  })

  test('rejects negative', () => {
    assert.throws(() => resolveMaxRetries(-1))
  })
})

describe('retryableErrorKind', () => {
  test('classifies rejected vs ambiguous', () => {
    assert.equal(retryableErrorKind(err('ECONNREFUSED')), 'rejected')
    assert.equal(retryableErrorKind(err('ENOTFOUND')), 'rejected')
    assert.equal(retryableErrorKind(err('ECONNRESET')), 'ambiguous')
    assert.equal(retryableErrorKind(err('UND_ERR_SOCKET')), 'ambiguous')
  })

  test('walks the cause chain', () => {
    const wrapped = new TypeError('fetch failed')
    ;(wrapped as { cause?: unknown }).cause = err('ECONNRESET')
    assert.equal(retryableErrorKind(wrapped), 'ambiguous')
  })

  test('aborts and unknown errors are not retryable', () => {
    const abort = new DOMException('Aborted', 'AbortError')
    assert.equal(retryableErrorKind(abort), undefined)
    assert.equal(retryableErrorKind(new Error('boom')), undefined)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    // Make backoff instant so tests don't sleep.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('retries=0 returns the inner fetch unwrapped', () => {
    const inner = (() => {}) as unknown as typeof fetch
    assert.strictEqual(withRetry(inner, 0), inner)
  })

  test('retries a 503 then succeeds (GET, idempotent)', async () => {
    const { fetch, calls } = fakeFetch([
      new Response(null, { status: 503 }),
      new Response('ok', { status: 200 }),
    ])
    const wrapped = withRetry(fetch, 3)
    const res = await wrapped('https://api.test/sandboxes')
    assert.equal(res.status, 200)
    assert.equal(calls.length, 2)
  })

  test('honors Retry-After delay on 429', async () => {
    const sleeps: number[] = []
    const realSetTimeout = globalThis.setTimeout
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      cb: () => void,
      ms?: number
    ) => {
      sleeps.push(ms ?? 0)
      return realSetTimeout(cb, 0)
    }) as typeof setTimeout)

    const { fetch } = fakeFetch([
      new Response(null, { status: 429, headers: { 'retry-after': '2' } }),
      new Response('ok', { status: 200 }),
    ])
    const wrapped = withRetry(fetch, 3)
    const res = await wrapped('https://api.test/sandboxes')
    assert.equal(res.status, 200)
    assert.deepEqual(sleeps, [2000])
  })

  test('does not retry non-retryable status', async () => {
    const { fetch, calls } = fakeFetch([new Response(null, { status: 400 })])
    const wrapped = withRetry(fetch, 3)
    const res = await wrapped('https://api.test/sandboxes')
    assert.equal(res.status, 400)
    assert.equal(calls.length, 1)
  })

  test('exhausts retries and returns the last response', async () => {
    const { fetch, calls } = fakeFetch([new Response(null, { status: 502 })])
    const wrapped = withRetry(fetch, 2)
    const res = await wrapped('https://api.test/sandboxes')
    assert.equal(res.status, 502)
    assert.equal(calls.length, 3) // 1 + 2 retries
  })

  test('POST: 502 (ambiguous) is NOT retried', async () => {
    const { fetch, calls } = fakeFetch([new Response(null, { status: 502 })])
    const wrapped = withRetry(fetch, 3)
    const res = await wrapped('https://api.test/rpc', {
      method: 'POST',
      body: 'x',
    })
    assert.equal(res.status, 502)
    assert.equal(calls.length, 1)
  })

  test('POST: 429 (rejected) IS retried', async () => {
    const { fetch, calls } = fakeFetch([
      new Response(null, { status: 429 }),
      new Response('ok', { status: 200 }),
    ])
    const wrapped = withRetry(fetch, 3)
    const res = await wrapped('https://api.test/rpc', {
      method: 'POST',
      body: 'x',
    })
    assert.equal(res.status, 200)
    assert.equal(calls.length, 2)
  })

  test('POST: 503 (ambiguous) is NOT retried', async () => {
    const { fetch, calls } = fakeFetch([new Response(null, { status: 503 })])
    const wrapped = withRetry(fetch, 3)
    const res = await wrapped('https://api.test/rpc', {
      method: 'POST',
      body: 'x',
    })
    assert.equal(res.status, 503)
    assert.equal(calls.length, 1)
  })

  test('retries on a transient connection error then succeeds', async () => {
    const { fetch, calls } = fakeFetch([
      err('ECONNRESET'),
      new Response('ok', { status: 200 }),
    ])
    const wrapped = withRetry(fetch, 3)
    const res = await wrapped('https://api.test/sandboxes')
    assert.equal(res.status, 200)
    assert.equal(calls.length, 2)
  })

  test('does not retry on abort', async () => {
    const { fetch, calls } = fakeFetch([
      new DOMException('Aborted', 'AbortError'),
    ])
    const wrapped = withRetry(fetch, 3)
    let threw = false
    try {
      await wrapped('https://api.test/sandboxes')
    } catch {
      threw = true
    }
    assert.ok(threw)
    assert.equal(calls.length, 1)
  })

  test('streaming body is passed through without retry', async () => {
    const { fetch, calls } = fakeFetch([new Response(null, { status: 503 })])
    const wrapped = withRetry(fetch, 3)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk'))
        controller.close()
      },
    })
    const res = await wrapped('https://api.test/rpc', {
      method: 'POST',
      body: stream,
      // @ts-expect-error duplex is required for stream bodies in undici
      duplex: 'half',
    })
    assert.equal(res.status, 503)
    assert.equal(calls.length, 1)
  })
})
