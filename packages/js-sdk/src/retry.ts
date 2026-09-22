import { InvalidArgumentError } from './errors'
import { isReadableStreamLike } from './is'

const MAX_RETRY_AFTER_SECONDS = 2_147_483
const MAX_RETRY_WAIT_WITHOUT_TIMEOUT_MS = 60_000
const BACKOFF_BASE_MS = 100
const BACKOFF_MAX_MS = 10_000
const BACKOFF_JITTER_MIN = 0.5
const RETRYABLE_STATUSES = new Set([429, 502, 503])
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
// GET/PUT/PATCH/DELETE are idempotent by HTTP semantics. A POST is retried
// after a network error that may have occurred once the request was written
// only if it is listed here: a replay is a no-op or fails with a 404/409 the
// SDK already tolerates. POSTs that mint a resource without a client-supplied
// idempotency key (sandbox/fork/snapshot/API-key/volume/secret/webhook
// creation) must stay off the list — a replay could create a duplicate — and
// so does any new POST until it is reviewed. Connection-establishment failures
// are retried for every operation regardless: the request never left.
const REPLAYABLE_METHODS = new Set(['GET', 'PUT', 'PATCH', 'DELETE'])
const REPLAYABLE_OPERATIONS: [method: string, path: RegExp][] = [
  ['POST', /^\/sandboxes\/[^/]+\/(pause|resume|timeout|refreshes)$/],
  ['POST', /^\/(v2\/)?sandboxes\/[^/]+\/connect$/],
  ['POST', /^\/v3\/templates$/],
  ['POST', /^\/v2\/templates\/[^/]+\/builds\/[^/]+$/],
  ['POST', /^\/templates\/tags$/],
  ['POST', /^\/nodes\/[^/]+$/],
  ['POST', /^\/admin\/teams\/[^/]+\/(sandboxes\/kill|builds\/cancel)$/],
  ['POST', /^\/secrets\/[^/]+$/],
]

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
 * Whether `request` may be sent again after a network error that may have
 * occurred once the request was written (see `REPLAYABLE_OPERATIONS`).
 */
export function isReplayable(request: Request): boolean {
  if (REPLAYABLE_METHODS.has(request.method)) return true
  const { pathname } = new URL(request.url)
  return REPLAYABLE_OPERATIONS.some(
    ([method, path]) => request.method === method && path.test(pathname)
  )
}

/**
 * Whether a `fetch` rejection may be retried. Connection-establishment
 * failures are always retried: the request never left. For a replayable
 * request any other network error is retried as well — a connection dropped
 * mid-request, or the opaque `TypeError` browsers and Cloudflare Workers raise
 * for every network failure. Aborts are never retried.
 */
export function isRetryableFetchError(
  error: unknown,
  replayable: boolean
): boolean {
  if (error instanceof DOMException) return false
  if (isConnectionError(error)) return true
  return replayable && error instanceof Error
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

  return backoffMs(attempt, random)
}

/**
 * Retry replayable requests after a 429 carrying `Retry-After`, a 502/503
 * (using `Retry-After` when present, exponential backoff otherwise) or a
 * network failure (exponential backoff; see {@link isRetryableFetchError}).
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
    const replayable = isReplayable(request)

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
          !isRetryableFetchError(error, replayable)
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
