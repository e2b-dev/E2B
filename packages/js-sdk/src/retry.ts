import { InvalidArgumentError } from './errors'
import { isReadableStreamLike } from './is'

const MAX_RETRY_AFTER_SECONDS = 2_147_483
const MAX_RETRY_WAIT_WITHOUT_TIMEOUT_MS = 60_000

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

/** Retry replayable requests after a 429 carrying `Retry-After`. */
export function withRateLimitRetry(
  fetchImpl: typeof fetch,
  retries: number,
  requestTimeoutMs: number,
  dependencies: RetryDependencies = {}
): typeof fetch {
  const monotonic = dependencies.monotonic ?? (() => performance.now())
  const sleep = dependencies.sleep ?? wait

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
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
      const delayMs = retryAfter === undefined ? undefined : retryAfter * 1000

      if (
        response.status !== 429 ||
        delayMs === undefined ||
        attempt === retries ||
        monotonic() + delayMs >= deadline
      ) {
        return response
      }

      await response.body?.cancel().catch(() => {})
      await sleep(delayMs, request.signal)
    }
  }) as typeof fetch
}
