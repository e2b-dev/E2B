import { describe, expect, test, vi } from 'vitest'

import {
  isConnectionError,
  isReplayable,
  isRetryableFetchError,
  parseRetryAfter,
  resolveRetries,
  withRetry,
  isNetworkError,
} from '../src/retry'
import { EnvdApiClient } from '../src/envd/api'
import { InvalidArgumentError } from '../src/errors'

describe('resolveRetries', () => {
  test('accepts non-negative integers', () => {
    expect(resolveRetries(0)).toBe(0)
    expect(resolveRetries(3)).toBe(3)
  })

  test.each([-1, 1.5, Number.NaN])('rejects %s', (retries) => {
    expect(() => resolveRetries(retries)).toThrow(InvalidArgumentError)
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
  const fetchWithRetry = withRetry(fetchImpl, 1, 10_000, {
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

test.each(['', '{"templateID":"base"}'])(
  'replays a serialized API body %j across attempts',
  async (body) => {
    const controller = new AbortController()
    const request = new Request('https://api.e2b.test/resource', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': 'test-key' },
      signal: controller.signal,
      redirect: 'manual',
      credentials: 'include',
    })
    const attempts: Request[] = []
    const bodies: string[] = []
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const attempt = input as Request
      attempts.push(attempt)
      bodies.push(await attempt.text())
      return new Response(null, {
        status: attempts.length < 3 ? 429 : 200,
        headers: { 'Retry-After': '0' },
      })
    }) as typeof fetch

    const response = await withRetry(fetchImpl, 2, 10_000)(request)

    expect(response.status).toBe(200)
    expect(bodies).toEqual([body, body, body])
    expect(new Set(attempts).size).toBe(3)
    controller.abort()
    for (const attempt of attempts) {
      expect(attempt.url).toBe(request.url)
      expect(attempt.method).toBe('POST')
      expect([...attempt.headers]).toEqual([...request.headers])
      expect(attempt.redirect).toBe('manual')
      // Deno and Cloudflare do not expose Request.credentials.
      expect(attempt.credentials).toBe(request.credentials)
      expect(attempt.signal.aborted).toBe(true)
    }
  }
)

test('returns the final 429 after exhausting retries', async () => {
  const fetchImpl = vi.fn(async () => {
    return new Response(null, {
      status: 429,
      headers: { 'Retry-After': '0' },
    })
  }) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 2, 10_000, {
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
  const fetchWithRetry = withRetry(fetchImpl, 1, 1_000, {
    monotonic: () => 0,
    sleep,
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource')

  expect(response.status).toBe(429)
  expect(fetchImpl).toHaveBeenCalledOnce()
  expect(sleep).not.toHaveBeenCalled()
})

test('bounds retry waits when the request timeout is disabled', async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(null, {
        status: 429,
        headers: { 'Retry-After': '60' },
      })
  ) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 3, 0, {
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
  const fetchWithRetry = withRetry(fetchImpl, 2, 10_000, {
    monotonic: () => 0,
    sleep,
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource')

  expect(response).toBe(rateLimited)
  expect(response.bodyUsed).toBe(false)
  expect(fetchImpl).toHaveBeenCalledOnce()
  expect(sleep).not.toHaveBeenCalled()
})

test.each([502, 503])(
  'retries a %s with exponential backoff and jitter',
  async (status) => {
    const statuses = [status, status, status, 200]
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: statuses.shift() })
    ) as typeof fetch
    const sleep = vi.fn(async () => {})
    const random = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0.5)
    const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
      monotonic: () => 0,
      sleep,
      random,
    })

    const response = await fetchWithRetry('https://api.e2b.test/resource')

    expect(response.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([50, 200, 300])
  }
)

test.each([
  ['POST', '/sandboxes', 1],
  ['POST', '/secrets/secret-1', 1],
  ['POST', '/sandboxes/sbx-1/pause', 2],
  ['GET', '/sandboxes', 2],
])('a 502 for %s %s is attempted %i time(s)', async (method, path, calls) => {
  const statuses = [502, 200]
  const fetchImpl = vi.fn(
    async () => new Response(null, { status: statuses.shift() })
  ) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: async () => {},
  })

  const response = await fetchWithRetry(`https://api.e2b.test${path}`, {
    method,
  })

  expect(response.status).toBe(calls === 1 ? 502 : 200)
  expect(fetchImpl).toHaveBeenCalledTimes(calls)
})

function refusal(errorCode: string): Response {
  return new Response(
    JSON.stringify({ code: 503, error_code: errorCode, message: 'refused' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}

// The peek at a 503 body waits through the injected sleep too, so a sleep that
// resolves at once ends every peek before an in-memory body can be read; the
// peek tests use a real, short timer instead.
const realSleep = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.min(delayMs, 100)))

test('returns a 503 carrying a non-retryable error_code after one request, body intact', async () => {
  const fetchImpl = vi.fn(async () =>
    refusal('sandbox_pause_refused')
  ) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: realSleep,
  })

  const response = await fetchWithRetry(
    'https://api.e2b.test/sandboxes/sbx-1/pause',
    { method: 'POST' }
  )

  expect(response.status).toBe(503)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect((await response.json()).error_code).toBe('sandbox_pause_refused')
})

test('a 503 whose body was already consumed is not peeked at and is retried', async () => {
  const consumed = refusal('sandbox_pause_refused')
  await consumed.text()
  const responses = [consumed, new Response('ok')]
  const fetchImpl = vi.fn(async () => responses.shift()!) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: realSleep,
  })

  const response = await fetchWithRetry(
    'https://api.e2b.test/sandboxes/sbx-1/pause',
    { method: 'POST' }
  )

  expect(response.status).toBe(200)
  expect(fetchImpl).toHaveBeenCalledTimes(2)
})

test('a 503 whose body is locked is not peeked at and is retried', async () => {
  const locked = refusal('sandbox_pause_refused')
  const reader = locked.body!.getReader()
  const responses = [locked, new Response('ok')]
  const fetchImpl = vi.fn(async () => responses.shift()!) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: realSleep,
  })

  const response = await fetchWithRetry(
    'https://api.e2b.test/sandboxes/sbx-1/pause',
    { method: 'POST' }
  )

  expect(response.status).toBe(200)
  expect(fetchImpl).toHaveBeenCalledTimes(2)
  reader.releaseLock()
})

test('a 503 is not peeked at when the request was already aborted', async () => {
  const controller = new AbortController()
  const responses = [refusal('sandbox_pause_refused'), new Response('ok')]
  const fetchImpl = vi.fn(async () => {
    controller.abort()
    return responses.shift()!
  }) as typeof fetch
  // A sleep that ignores the signal, so the loop is observed past the peek.
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep,
  })

  await fetchWithRetry('https://api.e2b.test/sandboxes/sbx-1/pause', {
    method: 'POST',
    signal: controller.signal,
  })

  // Not short-circuited although the body carried the code, and not peeked
  // at: the only sleep is the retry delay (a peek would have added one).
  expect(fetchImpl).toHaveBeenCalledTimes(2)
  expect(sleep).toHaveBeenCalledTimes(1)
})

test('a 503 whose body stalls is retried after its inspection budget (max(delay, 1 s)), not held for the whole request budget', async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(new ReadableStream({ start() {} }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
  ) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep,
    random: () => 0,
  })

  const startedAt = performance.now()
  const response = await fetchWithRetry(
    'https://api.e2b.test/sandboxes/sbx-1/pause',
    { method: 'POST' }
  )

  // Every attempt peeks for the inspection budget (1 s, above the 50, 100,
  // 200 ms backoffs) through the injected sleep, then sleeps its backoff
  // (the stub clock never advances, so nothing is subtracted), and retries.
  expect(response.status).toBe(503)
  expect(fetchImpl).toHaveBeenCalledTimes(4)
  expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([
    1000, 50, 1000, 100, 1000, 200,
  ])
  expect(performance.now() - startedAt).toBeLessThan(1_000)
})

test('a refusal that arrives within the delay still short-circuits', async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            setTimeout(() => {
              controller.enqueue(
                new TextEncoder().encode(
                  '{"code":503,"error_code":"sandbox_pause_refused","message":"refused"}'
                )
              )
              controller.close()
            }, 20)
          },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
  ) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: realSleep,
    random: () => 1,
  })

  const response = await fetchWithRetry(
    'https://api.e2b.test/sandboxes/sbx-1/pause',
    { method: 'POST' }
  )

  expect(response.status).toBe(503)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  // Peeked at and returned: the caller's body is untouched and still readable.
  expect(response.bodyUsed).toBe(false)
  expect(response.body?.locked).toBe(false)
  expect((await response.json()).error_code).toBe('sandbox_pause_refused')
})

test('a refusal body arriving after the first backoff but within the inspection budget still short-circuits', async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            setTimeout(() => {
              controller.enqueue(
                new TextEncoder().encode(
                  '{"code":503,"error_code":"sandbox_pause_refused","message":"refused"}'
                )
              )
              controller.close()
            }, 120)
          },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
  ) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: (delayMs) =>
      new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 500))),
    // First backoff 50 ms: shorter than the body's 120 ms.
    random: () => 0,
  })

  const response = await fetchWithRetry(
    'https://api.e2b.test/sandboxes/sbx-1/pause',
    { method: 'POST' }
  )

  expect(response.status).toBe(503)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect((await response.json()).error_code).toBe('sandbox_pause_refused')
})

test('the content type is matched by media type, whatever its case and parameters', async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ code: 503, error_code: 'sandbox_pause_refused' }),
        {
          status: 503,
          headers: { 'Content-Type': 'Application/JSON; charset=UTF-8' },
        }
      )
  ) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: realSleep,
  })

  const response = await fetchWithRetry(
    'https://api.e2b.test/sandboxes/sbx-1/pause',
    { method: 'POST' }
  )

  expect(response.status).toBe(503)
  expect(fetchImpl).toHaveBeenCalledTimes(1)
})

test('a 503 whose body keeps dripping past the inspection budget is retried and the clone read is cancelled', async () => {
  let served = 0
  let cancelled = 0
  const drip = () => {
    let stopped = false
    let pending: ReturnType<typeof setTimeout> | undefined
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        return new Promise((resolve) => {
          pending = setTimeout(() => {
            // The source is only told about one cancel; after it the
            // controller is closed and must not be enqueued into.
            if (!stopped) {
              served++
              controller.enqueue(new TextEncoder().encode('{"error_code":"x'))
            }
            resolve()
          }, 5)
        })
      },
      cancel() {
        stopped = true
        cancelled++
        clearTimeout(pending)
      },
    })
  }
  const fetchImpl = vi.fn(
    async () =>
      new Response(drip(), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
  ) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep,
    random: () => 0,
  })

  const startedAt = performance.now()
  const response = await fetchWithRetry(
    'https://api.e2b.test/sandboxes/sbx-1/pause',
    { method: 'POST' }
  )
  const servedAtReturn = served

  // The last response is returned without a peek (no retry left), so the
  // untouched-body assertions live in the refusal-within-the-delay test.
  expect(response.status).toBe(503)
  expect(fetchImpl).toHaveBeenCalledTimes(4)
  expect(sleep).toHaveBeenCalledTimes(6)
  expect(performance.now() - startedAt).toBeLessThan(1_000)

  // The three retried responses had both tee branches cancelled (the peek's
  // reader and the discarded body), so their sources were cancelled; the
  // returned one keeps the caller's branch alive. With the peek's reader
  // cancelled nothing keeps pulling it: at most the tee's one-chunk
  // high-water mark can still be served for the caller's branch.
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(cancelled).toBe(3)
  expect(served - servedAtReturn).toBeLessThanOrEqual(2)
})

test('a 503 whose body exceeds the size cap is a plain 503 and is retried', async () => {
  const large = JSON.stringify({
    code: 503,
    error_code: 'sandbox_pause_refused',
    message: 'x'.repeat(9 * 1024),
  })
  const responses = [
    new Response(large, {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }),
    new Response('ok'),
  ]
  const fetchImpl = vi.fn(async () => responses.shift()!) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: realSleep,
  })

  const response = await fetchWithRetry(
    'https://api.e2b.test/sandboxes/sbx-1/pause',
    { method: 'POST' }
  )

  expect(response.status).toBe(200)
  expect(fetchImpl).toHaveBeenCalledTimes(2)
})

test('retries a 503 carrying another error_code', async () => {
  const responses = [
    refusal('sandbox_capacity_unavailable'),
    new Response('ok'),
  ]
  const fetchImpl = vi.fn(async () => responses.shift()!) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: realSleep,
  })

  const response = await fetchWithRetry('https://api.e2b.test/sandboxes', {
    method: 'POST',
  })

  expect(response.status).toBe(200)
  expect(fetchImpl).toHaveBeenCalledTimes(2)
})

test('retries a 503 for a non-replayable POST', async () => {
  const statuses = [503, 200]
  const fetchImpl = vi.fn(
    async () => new Response(null, { status: statuses.shift() })
  ) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep: async () => {},
  })

  const response = await fetchWithRetry('https://api.e2b.test/sandboxes', {
    method: 'POST',
  })

  expect(response.status).toBe(200)
  expect(fetchImpl).toHaveBeenCalledTimes(2)
})

test('caps the backoff for long retry sequences', async () => {
  const fetchImpl = vi.fn(
    async () => new Response(null, { status: 503 })
  ) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 8, 0, {
    monotonic: () => 0,
    sleep,
    random: () => 1,
  })

  await fetchWithRetry('https://api.e2b.test/resource')

  expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([
    100, 200, 400, 800, 1_600, 3_200, 6_400, 10_000,
  ])
})

test('prefers Retry-After over backoff for a 503', async () => {
  const statuses = [503, 200]
  const fetchImpl = vi.fn(
    async () =>
      new Response(null, {
        status: statuses.shift(),
        headers: { 'Retry-After': '3' },
      })
  ) as typeof fetch
  const sleep = vi.fn(async () => {})
  const random = vi.fn(() => 0)
  const fetchWithRetry = withRetry(fetchImpl, 3, 10_000, {
    monotonic: () => 0,
    sleep,
    random,
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource')

  expect(response.status).toBe(200)
  expect(sleep).toHaveBeenCalledWith(3_000, expect.any(AbortSignal))
  expect(random).not.toHaveBeenCalled()
})

test('returns the final 503 after exhausting retries', async () => {
  const fetchImpl = vi.fn(
    async () => new Response('busy', { status: 503 })
  ) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 2, 10_000, {
    monotonic: () => 0,
    sleep: async () => {},
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource')

  expect(response.status).toBe(503)
  expect(await response.text()).toBe('busy')
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})

test('propagates 502 when the backoff would exceed the request timeout', async () => {
  const fetchImpl = vi.fn(
    async () => new Response(null, { status: 502 })
  ) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 3, 80, {
    monotonic: () => 0,
    sleep,
    random: () => 1,
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource')

  expect(response.status).toBe(502)
  expect(fetchImpl).toHaveBeenCalledOnce()
  expect(sleep).not.toHaveBeenCalled()
})

test.each([400, 404, 500, 504])('does not retry a %s', async (status) => {
  const failed = new Response('error', { status })
  const fetchImpl = vi.fn(async () => failed) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 3, 10_000, {
    monotonic: () => 0,
    sleep,
  })

  const response = await fetchWithRetry('https://api.e2b.test/resource')

  expect(response).toBe(failed)
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
  const fetchWithRetry = withRetry(fetchImpl, 1, 10_000)
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

test.each([0, 3])(
  'retries=%s passes a streaming request through unchanged',
  async (retries) => {
    const fetchImpl = vi.fn(async () => new Response('ok')) as typeof fetch
    const fetchWithRetry = withRetry(fetchImpl, retries, 10_000)
    const body = new ReadableStream()
    const init = {
      method: 'POST',
      body,
      duplex: 'half' as const,
    }

    await fetchWithRetry('https://api.e2b.test/resource', init)

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.e2b.test/resource',
      init
    )
    expect(body.locked).toBe(false)
  }
)

test('envd clients do not retry rate-limited requests', async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(null, {
        status: 429,
        headers: { 'Retry-After': '0' },
      })
  ) as typeof fetch
  const client = new EnvdApiClient(
    {
      apiUrl: 'https://envd.e2b.test',
      logger: undefined,
      fetch: fetchImpl,
    },
    { version: '0.0.0' }
  )

  const response = await client.api.GET('/health')

  expect(response.response.status).toBe(429)
  expect(fetchImpl).toHaveBeenCalledOnce()
})

function connectError(code: string, syscall = 'connect'): TypeError {
  return new TypeError('fetch failed', {
    cause: Object.assign(new Error(`${syscall} ${code}`), { code, syscall }),
  })
}

// Shapes observed from `fetch()` against a refused port / unresolvable host.
const connectFailures = {
  'Node refused': connectError('ECONNREFUSED'),
  'Node dns': connectError('ENOTFOUND', 'getaddrinfo'),
  'Node connect timeout': connectError('ETIMEDOUT'),
  'Node happy-eyeballs': Object.assign(new Error('fetch failed'), {
    cause: new AggregateError([connectError('ECONNREFUSED').cause]),
  }),
  'Bun refused': Object.assign(
    new TypeError('Unable to connect. Is the computer able to access the url?'),
    { code: 'ConnectionRefused' }
  ),
  'Bun dns': Object.assign(
    new TypeError('getaddrinfo ENOTFOUND nonexistent.invalid'),
    { code: 'ENOTFOUND', syscall: 'getaddrinfo' }
  ),
  'Deno refused': new TypeError(
    'error sending request for url (http://x): client error (Connect): tcp connect error'
  ),
  'Deno dns': new TypeError(
    'error sending request for url (http://x): client error (Connect): dns error'
  ),
}

// Connection dropped after the request was (at least partially) written:
// the server may have processed it, so these are replayed only for
// operations that are safe to replay.
const terminated = {
  Node: new TypeError('terminated'),
  'Node reset': new TypeError('fetch failed', {
    cause: Object.assign(new Error('read ECONNRESET'), {
      code: 'ECONNRESET',
      syscall: 'read',
    }),
  }),
  'Node socket': new TypeError('fetch failed', {
    cause: Object.assign(new Error('socket'), { code: 'UND_ERR_SOCKET' }),
  }),
  Bun: new Error('The socket connection was closed unexpectedly'),
  Deno: new TypeError('error reading a body from connection'),
  'Deno send': new TypeError(
    'error sending request for url (http://x): client error (SendRequest)'
  ),
  'Cloudflare Workers': new Error('Network connection lost.'),
  Browser: new TypeError('network error'),
}

// Opaque failures that look identical whether the connection was never
// established or was lost mid-request.
const opaque = {
  'Cloudflare Workers': Object.assign(new Error('Network connection lost.'), {
    remote: true,
    retryable: true,
  }),
  'Cloudflare Workers dns': Object.assign(
    new Error('internal error; reference = abc'),
    { remote: true }
  ),
  Chrome: new TypeError('Failed to fetch'),
  Firefox: new TypeError('NetworkError when attempting to fetch resource.'),
  Safari: new TypeError('Load failed'),
}

const aborts = {
  abort: new DOMException('aborted', 'AbortError'),
  timeout: new DOMException('timed out', 'TimeoutError'),
}

describe('isNetworkError', () => {
  test.each([
    ...Object.entries(connectFailures),
    ['Chrome', opaque.Chrome],
    ['Firefox', opaque.Firefox],
    ['Safari', opaque.Safari],
  ])('recognizes %s', (_, error) => {
    expect(isNetworkError(error)).toBe(true)
  })

  test.each([
    ...Object.entries(terminated),
    ...Object.entries(aborts),
    ['other TypeError', new TypeError('Failed to parse URL')],
    ['non-error', 'Failed to fetch'],
  ])('rejects %s', (_, error) => {
    expect(isNetworkError(error)).toBe(false)
  })
})

describe('isConnectionError', () => {
  test.each(Object.entries(connectFailures))('recognizes %s', (_, error) => {
    expect(isConnectionError(error)).toBe(true)
  })

  test.each([
    ...Object.entries(terminated),
    ...Object.entries(opaque),
    ...Object.entries(aborts),
    ['non-error', 'ECONNREFUSED'],
  ])('rejects %s', (_, error) => {
    expect(isConnectionError(error)).toBe(false)
  })
})

describe('isRetryableFetchError', () => {
  test.each(Object.entries(connectFailures))(
    'retries %s for any operation',
    (_, error) => {
      expect(isRetryableFetchError(error, true)).toBe(true)
      expect(isRetryableFetchError(error, false)).toBe(true)
    }
  )

  test.each([...Object.entries(terminated), ...Object.entries(opaque)])(
    'retries %s only for a replayable operation',
    (_, error) => {
      expect(isRetryableFetchError(error, true)).toBe(true)
      expect(isRetryableFetchError(error, false)).toBe(false)
    }
  )

  test.each([...Object.entries(aborts), ['non-error', 'ECONNREFUSED']])(
    'never retries %s',
    (_, error) => {
      expect(isRetryableFetchError(error, true)).toBe(false)
      expect(isRetryableFetchError(error, false)).toBe(false)
    }
  )
})

const nonReplayable = [
  ['POST', '/sandboxes'],
  ['POST', '/v2/sandboxes'],
  ['POST', '/sandboxes/sbx-1/fork'],
  ['POST', '/sandboxes/sbx-1/snapshots'],
  ['POST', '/api-keys'],
  ['POST', '/admin/teams/team-1/api-keys'],
  ['POST', '/volumes'],
  ['POST', '/secrets'],
  ['POST', '/secrets/secret-1'],
  ['POST', '/events/webhooks'],
  // POSTs not on the allowlist: unknown and near-miss paths
  ['POST', '/sandboxes/sbx-1/pause/extra'],
  ['POST', '/sandboxes/a/b/pause'],
  ['POST', '/templates/tags/extra'],
  ['POST', '/new-resources'],
]

const replayable = [
  ['GET', '/sandboxes'],
  ['GET', '/sandboxes/sbx-1'],
  ['DELETE', '/sandboxes/sbx-1'],
  ['POST', '/sandboxes/sbx-1/pause'],
  ['POST', '/sandboxes/sbx-1/resume'],
  ['POST', '/sandboxes/sbx-1/connect'],
  ['POST', '/v2/sandboxes/sbx-1/connect'],
  ['POST', '/sandboxes/sbx-1/timeout'],
  ['POST', '/sandboxes/sbx-1/refreshes'],
  ['PUT', '/sandboxes/sbx-1/network'],
  ['PATCH', '/templates/tpl-1'],
  ['POST', '/v3/templates'],
  ['POST', '/v2/templates/tpl-1/builds/build-1'],
  ['POST', '/templates/tags'],
  ['DELETE', '/templates/tags'],
  ['POST', '/nodes/node-1'],
  ['POST', '/admin/teams/team-1/sandboxes/kill'],
  ['POST', '/admin/teams/team-1/builds/cancel'],
  ['DELETE', '/volumes/vol-1'],
  ['PATCH', '/events/webhooks/hook-1'],
]

describe('isReplayable', () => {
  test.each(nonReplayable)('%s %s is not replayable', (method, path) => {
    const request = new Request(`https://api.e2b.test${path}?x=1`, { method })
    expect(isReplayable(request)).toBe(false)
  })

  test.each(replayable)('%s %s is replayable', (method, path) => {
    const request = new Request(`https://api.e2b.test${path}?x=1`, { method })
    expect(isReplayable(request)).toBe(true)
  })
})

test('retries a connection failure with exponential backoff', async () => {
  const outcomes = [
    () => Promise.reject(connectError('ECONNREFUSED')),
    () => Promise.reject(connectError('ENOTFOUND', 'getaddrinfo')),
    () => Promise.resolve(new Response('ok')),
  ]
  const fetchImpl = vi.fn(() => outcomes.shift()!()) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep,
    random: () => 1,
  })

  const response = await fetchWithRetry('https://api.e2b.test/sandboxes', {
    method: 'POST',
    body: 'payload',
  })

  expect(response.status).toBe(200)
  expect(fetchImpl).toHaveBeenCalledTimes(3)
  expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([100, 200])
  const bodies = await Promise.all(
    fetchImpl.mock.calls.map(([request]) => (request as Request).text())
  )
  expect(bodies).toEqual(['payload', 'payload', 'payload'])
})

test('rethrows the connection failure after exhausting retries', async () => {
  const error = connectError('ECONNREFUSED')
  const fetchImpl = vi.fn(async () => {
    throw error
  }) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 2, 10_000, {
    monotonic: () => 0,
    sleep: async () => {},
  })

  await expect(fetchWithRetry('https://api.e2b.test/resource')).rejects.toBe(
    error
  )
  expect(fetchImpl).toHaveBeenCalledTimes(3)
})

test('rethrows a connection failure when the backoff would exceed the request timeout', async () => {
  const error = connectError('ECONNREFUSED')
  const fetchImpl = vi.fn(async () => {
    throw error
  }) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 3, 80, {
    monotonic: () => 0,
    sleep,
    random: () => 1,
  })

  await expect(fetchWithRetry('https://api.e2b.test/resource')).rejects.toBe(
    error
  )
  expect(fetchImpl).toHaveBeenCalledOnce()
  expect(sleep).not.toHaveBeenCalled()
})

test.each([
  ['GET', '/sandboxes'],
  ['POST', '/sandboxes/sbx-1/pause'],
  ['DELETE', '/sandboxes/sbx-1'],
])('retries an opaque network error for %s %s', async (method, path) => {
  const outcomes = [
    () => Promise.reject(opaque.Chrome),
    () => Promise.reject(terminated['Node reset']),
    () => Promise.resolve(new Response('ok')),
  ]
  const fetchImpl = vi.fn(() => outcomes.shift()!()) as typeof fetch
  const sleep = vi.fn(async () => {})
  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
    monotonic: () => 0,
    sleep,
    random: () => 1,
  })

  const response = await fetchWithRetry(`https://api.e2b.test${path}`, {
    method,
  })

  expect(response.status).toBe(200)
  expect(fetchImpl).toHaveBeenCalledTimes(3)
  expect(sleep.mock.calls.map(([delayMs]) => delayMs)).toEqual([100, 200])
})

test.each([
  ['opaque network error', opaque.Chrome, 'POST', '/sandboxes'],
  ['dropped connection', terminated['Node reset'], 'POST', '/v2/sandboxes'],
  [
    'dropped connection',
    terminated['Cloudflare Workers'],
    'POST',
    '/sandboxes/sbx-1/fork',
  ],
  ['abort', aborts.abort, 'GET', '/sandboxes'],
])('does not retry %s for %s %s', async (_, error, method, path) => {
  const fetchImpl = vi.fn(async () => {
    throw error
  }) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 10_000, {
    monotonic: () => 0,
    sleep: async () => {},
  })

  await expect(
    fetchWithRetry(`https://api.e2b.test${path}`, { method })
  ).rejects.toBe(error)
  expect(fetchImpl).toHaveBeenCalledOnce()
})

test('does not retry a GET whose signal was aborted', async () => {
  const controller = new AbortController()
  const reason = new Error('cancelled by caller')
  const fetchImpl = vi.fn(async () => {
    controller.abort(reason)
    throw reason
  }) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 3, 10_000, {
    monotonic: () => 0,
    sleep: async () => {},
  })

  await expect(
    fetchWithRetry('https://api.e2b.test/resource', {
      signal: controller.signal,
    })
  ).rejects.toBe(reason)
  expect(fetchImpl).toHaveBeenCalledOnce()
})

test('retries=0 propagates a connection failure unchanged', async () => {
  const error = connectError('ECONNREFUSED')
  const fetchImpl = vi.fn(async () => {
    throw error
  }) as typeof fetch
  const fetchWithRetry = withRetry(fetchImpl, 0, 10_000)

  await expect(fetchWithRetry('https://api.e2b.test/resource')).rejects.toBe(
    error
  )
  expect(fetchImpl).toHaveBeenCalledOnce()
})
