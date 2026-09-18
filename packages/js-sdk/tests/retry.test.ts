import { describe, expect, test, vi } from 'vitest'

import {
  isConnectionError,
  isReplayable,
  isRetryableFetchError,
  parseRetryAfter,
  resolveRetries,
  withRetry,
} from '../src/retry'
import { NON_IDEMPOTENT_OPERATIONS } from '../src/api/retryPolicy.gen'
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
  ['POST', '/v3/templates'],
  ['POST', '/volumes'],
  ['POST', '/secrets'],
]

const replayable = [
  ['GET', '/sandboxes'],
  ['GET', '/sandboxes/sbx-1'],
  ['DELETE', '/sandboxes/sbx-1'],
  ['GET', '/sandboxes/sbx-1/fork'],
  ['POST', '/sandboxes/sbx-1/fork/extra'],
  ['POST', '/sandboxes/a/b/fork'],
  ['POST', '/sandboxes/sbx-1/pause'],
  ['POST', '/sandboxes/sbx-1/resume'],
  ['POST', '/sandboxes/sbx-1/connect'],
  ['POST', '/v2/sandboxes/sbx-1/connect'],
  ['POST', '/sandboxes/sbx-1/timeout'],
  ['POST', '/sandboxes/sbx-1/refreshes'],
  ['PUT', '/sandboxes/sbx-1/network'],
  ['PATCH', '/templates/tpl-1'],
  ['POST', '/v2/templates/tpl-1/builds/build-1'],
  ['POST', '/templates/tags'],
  ['DELETE', '/templates/tags'],
  ['POST', '/admin/teams/team-1/sandboxes/kill'],
  ['POST', '/secrets/secret-1'],
  ['DELETE', '/volumes/vol-1'],
  ['PATCH', '/events/webhooks/hook-1'],
]

describe('isReplayable', () => {
  test('covers every operation the spec marks non-idempotent', () => {
    expect(NON_IDEMPOTENT_OPERATIONS.length).toBeGreaterThan(0)
    for (const [method, template] of NON_IDEMPOTENT_OPERATIONS) {
      const path = template.replace(/\{[^}]+\}/g, 'id-1')
      const request = new Request(`https://api.e2b.test${path}`, { method })
      expect(isReplayable(request), `${method} ${template}`).toBe(false)
    }
  })

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
