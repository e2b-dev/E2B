import { InvalidArgumentError } from './errors'
import { isReadableStreamLike } from './is'

const MAX_RETRY_AFTER_SECONDS = 2_147_483
const MAX_RETRY_WAIT_WITHOUT_TIMEOUT_MS = 60_000
const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 8_000
const BACKOFF_JITTER_MIN = 0.5
const RETRYABLE_STATUSES = new Set([429, 502, 503])

export function resolveRetries(retries: number): number {
  if (!Number.isInteger(retries) || retries < 0) {
    throw new InvalidArgumentError(
      `Invalid retries=${retries}: expected a non-negative integer.`
    )
  }
  return retries
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

/**
 * Delay before the next attempt, or `undefined` when the response is not
 * retried: `Retry-After` when the server sends a usable one, otherwise
 * exponential backoff with jitter for 502/503. A 429 without `Retry-After`
 * is not retried.
 */
function retryDelayMs(
  response: Response,
  attempt: number,
  random: () => number
): number | undefined {
  if (!RETRYABLE_STATUSES.has(response.status)) return undefined

  const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
  if (retryAfter !== undefined) return retryAfter * 1000
  if (response.status === 429) return undefined

  const backoff = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS)
  return Math.floor(
    backoff * (BACKOFF_JITTER_MIN + random() * (1 - BACKOFF_JITTER_MIN))
  )
}

/**
 * Retry replayable requests after a 429 carrying `Retry-After` or a 502/503
 * (using `Retry-After` when present, exponential backoff otherwise).
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
      const response = await fetchImpl(
        attempt === retries ? request : request.clone()
      )
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
