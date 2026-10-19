import { InvalidArgumentError } from './errors'
import { isReadableStreamLike } from './is'

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key'

// Retries API responses marked `Should-Retry: true`, or selected statuses
// when the header is absent.
const MAX_RETRY_AFTER_SECONDS = 2_147_483
const MAX_RETRY_WAIT_WITHOUT_TIMEOUT_MS = 60_000
const BACKOFF_BASE_MS = 100
const BACKOFF_MAX_MS = 10_000
const BACKOFF_JITTER_MIN = 0.5
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])
// Error codes raised while establishing the connection, before any request
// bytes are written: Node/undici (`ECONNREFUSED`, `ENOTFOUND`, ...), Bun
// (`ConnectionRefused`). Post-write failures such as `ECONNRESET` are
// excluded: the server may have received the request.
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
  'EHOSTDOWN',
  'UND_ERR_CONNECT_TIMEOUT',
  'ConnectionRefused',
])
const CONNECTION_ERROR_SYSCALLS = new Set(['connect', 'getaddrinfo'])
// Deno reports hyper's connect-phase failures as `client error (Connect)`.
const DENO_CONNECTION_ERROR = /client error \(Connect\)/
// Browsers reject every network failure with an opaque `TypeError`:
// Chrome `Failed to fetch`, Firefox `NetworkError when attempting to fetch resource.`, Safari `Load failed`
const OPAQUE_NETWORK_ERROR =
  /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/

export function resolveRetries(retries: number): number {
  if (!Number.isInteger(retries) || retries < 0) {
    throw new InvalidArgumentError(
      `Invalid retries=${retries}: expected a non-negative integer.`
    )
  }
  return retries
}

export function resolveIdempotencyKey(
  key: string | undefined
): string | undefined {
  if (key === undefined) return undefined
  if (key.length < 1 || key.length > 255) {
    throw new InvalidArgumentError(
      `Invalid idempotencyKey: expected 1-255 characters, got ${key.length}.`
    )
  }
  return key
}

export function parseRetryAfter(
  value: string | null | undefined
): number | undefined {
  if (!value) return undefined

  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return undefined

  const delay = Number(trimmed)
  return Number.isSafeInteger(delay) && delay <= MAX_RETRY_AFTER_SECONDS
    ? delay
    : undefined
}

/**
 * Whether `error` (thrown by `fetch`) is a failure to establish the connection.
 * Walks `cause` chains and `AggregateError` members, as Node wraps the socket
 * error in a `TypeError('fetch failed')`.
 */
export function isConnectionError(error: unknown, depth = 0): boolean {
  if (!(error instanceof Error) || depth > 4) return false

  const { code, syscall } = error as { code?: unknown; syscall?: unknown }
  if (typeof code === 'string' && CONNECTION_ERROR_CODES.has(code)) return true
  if (typeof syscall === 'string' && CONNECTION_ERROR_SYSCALLS.has(syscall)) {
    return true
  }
  if (DENO_CONNECTION_ERROR.test(error.message)) return true

  if (error instanceof AggregateError) {
    return error.errors.some((member) => isConnectionError(member, depth + 1))
  }
  return isConnectionError(error.cause, depth + 1)
}

/**
 * Whether `error` (thrown by `fetch`) is a network failure: a connection error
 * (see {@link isConnectionError}) or the opaque `TypeError` browsers raise for any
 * network failure, which carries no code or syscall.
 */
export function isNetworkError(error: unknown): boolean {
  if (isConnectionError(error)) return true
  return error instanceof Error && OPAQUE_NETWORK_ERROR.test(error.message)
}

/**
 * Whether a `fetch` rejection is a connection-establishment failure. Aborts
 * and failures after the request may have been sent are not retried.
 */
export function isRetryableFetchError(error: unknown): boolean {
  if (error instanceof DOMException) return false
  return isConnectionError(error)
}

type RetryDependencies = {
  monotonic?: () => number
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>
  random?: () => number
}

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason)

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function backoffMs(attempt: number, random: () => number): number {
  const backoff = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS)
  return Math.floor(
    backoff * (BACKOFF_JITTER_MIN + random() * (1 - BACKOFF_JITTER_MIN))
  )
}

/**
 * Delay before the next attempt, or `undefined` unless `Should-Retry` is true
 * or the header is absent for a retryable status. A present header is
 * authoritative, including explicit `false`.
 */
function retryDelayMs(
  response: Response,
  attempt: number,
  random: () => number
): number | undefined {
  const shouldRetry = response.headers.get('Should-Retry')
  const retryable =
    shouldRetry === null
      ? RETRYABLE_STATUSES.has(response.status)
      : shouldRetry.trim().toLowerCase() === 'true'
  if (!retryable) return undefined

  const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
  if (retryAfter !== undefined) return retryAfter * 1000

  return backoffMs(attempt, random)
}

/**
 * Retries API responses marked `Should-Retry: true`, or 429/502/503/504
 * responses without the header, after `Retry-After` or exponential backoff.
 * Also retries connection-establishment failures.
 */
export function withRetry(
  fetchImpl: typeof fetch,
  retries: number,
  requestTimeoutMs: number,
  dependencies: RetryDependencies = {}
): typeof fetch {
  const monotonic = dependencies.monotonic ?? (() => performance.now())
  const sleep = dependencies.sleep ?? wait
  const random = dependencies.random ?? Math.random

  return (async (input, init) => {
    // Streaming bodies would be consumed by the first attempt and cannot be
    // replayed without buffering them, so they get a single attempt.
    if (retries === 0 || isReadableStreamLike(init?.body)) {
      return fetchImpl(input, init)
    }

    // Replaying a Request-form input via `clone()` is safe because the only
    // producer of those is openapi-fetch, which serializes every body to a
    // string before constructing the Request — cloning never tees a live
    // stream.
    const request =
      input instanceof Request && init === undefined
        ? input
        : new Request(input, init)
    const deadline =
      monotonic() + (requestTimeoutMs || MAX_RETRY_WAIT_WITHOUT_TIMEOUT_MS)

    for (let attempt = 0; ; attempt++) {
      let response: Response
      try {
        response = await fetchImpl(
          attempt === retries ? request : request.clone()
        )
      } catch (error) {
        if (
          attempt === retries ||
          request.signal.aborted ||
          !isRetryableFetchError(error)
        ) {
          throw error
        }

        const delayMs = backoffMs(attempt, random)
        if (monotonic() + delayMs >= deadline) throw error

        await sleep(delayMs, request.signal)
        continue
      }
      if (attempt === retries) return response

      const delayMs = retryDelayMs(response, attempt, random)
      if (delayMs === undefined || monotonic() + delayMs >= deadline) {
        return response
      }

      // Not awaited: some fetch interceptors never settle `cancel()`, and the
      // retry does not depend on the discarded body having been released.
      void response.body?.cancel().catch(() => {})
      await sleep(delayMs, request.signal)
    }
  }) as typeof fetch
}
