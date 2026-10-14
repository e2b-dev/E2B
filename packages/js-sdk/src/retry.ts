import {
  InvalidArgumentError,
  SANDBOX_PAUSE_REFUSED_ERROR_CODE,
} from './errors'
import { isReadableStreamLike } from './is'

const MAX_RETRY_AFTER_SECONDS = 2_147_483
const MAX_RETRY_WAIT_WITHOUT_TIMEOUT_MS = 60_000
const BACKOFF_BASE_MS = 100
const BACKOFF_MAX_MS = 10_000
const BACKOFF_JITTER_MIN = 0.5
const RETRYABLE_STATUSES = new Set([429, 502, 503])
// A 503 whose body carries one of these `error_code`s is a decision by the
// server, not transient capacity, and is answered after a single request.
const NON_RETRYABLE_ERROR_CODES = new Set([SANDBOX_PAUSE_REFUSED_ERROR_CODE])
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
// GET/PUT/PATCH/DELETE are idempotent by HTTP semantics. A POST is retried
// after a 502 or a network error that may have occurred once the request was
// written only if it is listed here: a replay is a no-op or fails with a
// 404/409 the SDK already tolerates. POSTs that mint a resource without a
// client-supplied idempotency key (sandbox/fork/snapshot/API-key/volume/secret/
// webhook creation) or append to one (secret update) must stay off the list —
// a replay could create a duplicate — and so does any new POST until it is
// reviewed. Connection-establishment failures
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
 * Whether `error` (thrown by `fetch`) is a network failure: a connection error
 * (see {@link isConnectionError}) or the opaque `TypeError` browsers raise for any
 * network failure, which carries no code or syscall.
 */
export function isNetworkError(error: unknown): boolean {
  if (isConnectionError(error)) return true
  return error instanceof Error && OPAQUE_NETWORK_ERROR.test(error.message)
}

/**
 * Whether `request` may be sent again after a 502 or a network error that may
 * have occurred once the request was written (see `REPLAYABLE_OPERATIONS`).
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

const BODY_READ_TIMED_OUT = Symbol('body read timed out')

/** The media type of a `Content-Type` value: lower-cased, parameters dropped. */
function mediaType(contentType: string | null): string {
  return (contentType ?? '').split(';', 1)[0].trim().toLowerCase()
}
// An error body larger than this cannot carry a code worth parsing; the read
// stops there and the 503 is retried as a plain one.
const MAX_ERROR_BODY_BYTES = 8 * 1024
// Time a 503 body is peeked at for a non-retryable code, independent of the
// jittered backoff: a slow refusal body within this still short-circuits, and
// a trickling non-refusal body costs at most this per attempt.
const PEEK_BUDGET_MS = 1_000

/**
 * Reads `reader` to the end into one buffer, or returns `undefined` once more
 * than `limit` bytes arrived.
 */
async function readUpTo(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  limit: number
): Promise<Uint8Array | undefined> {
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) return undefined
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/**
 * Whether a 503 carries a non-retryable `error_code` (see
 * `NON_RETRYABLE_ERROR_CODES`). Reads a clone through a reader this function
 * owns, capped at `MAX_ERROR_BODY_BYTES` and bounded by `budgetMs` (the
 * inspection budget, which overlaps the retry wait instead of adding to it;
 * waited through `sleep` so the injected clock governs it) and the request
 * signal;
 * when it stops early the reader is cancelled so the abandoned read does not
 * keep consuming the stream, and the answer is "not a refusal" so the 503 is
 * retried as before. A body that cannot be peeked at (none, not JSON,
 * consumed, locked) or a request already aborted is not a refusal either. The original body
 * stays untouched for the caller.
 */
async function isNonRetryableRefusal(
  response: Response,
  budgetMs: number,
  signal: AbortSignal,
  sleep: (delayMs: number, signal: AbortSignal) => Promise<void>
): Promise<boolean> {
  if (response.status !== 503 || signal.aborted) return false
  // Only a JSON body can carry the code; a proxy's HTML page is not peeked at.
  if (mediaType(response.headers.get('Content-Type')) !== 'application/json') {
    return false
  }
  const { body } = response
  if (!body || response.bodyUsed || body.locked) return false
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const timer = new AbortController()
  const onAbort = () => timer.abort(signal.reason)
  signal.addEventListener('abort', onAbort, { once: true })
  // Clamped so a huge budget cannot overflow setTimeout into a 1 ms timer.
  const bounded = Math.min(
    Math.max(0, budgetMs),
    MAX_RETRY_AFTER_SECONDS * 1000
  )
  try {
    const cloned = response.clone().body
    if (!cloned) return false
    reader = cloned.getReader()
    const bytes = await Promise.race([
      readUpTo(reader, MAX_ERROR_BODY_BYTES).catch(() => undefined),
      sleep(bounded, timer.signal).then(
        () => BODY_READ_TIMED_OUT,
        () => BODY_READ_TIMED_OUT
      ),
    ])
    if (typeof bytes === 'symbol' || bytes === undefined) {
      // Settles the pending read with done, so readUpTo ends too.
      void reader.cancel().catch(() => {})
      return false
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
      error_code?: unknown
    }
    return (
      typeof parsed?.error_code === 'string' &&
      NON_RETRYABLE_ERROR_CODES.has(parsed.error_code)
    )
  } catch {
    void reader?.cancel().catch(() => {})
    return false
  } finally {
    timer.abort()
    signal.removeEventListener('abort', onAbort)
  }
}

/**
 * Delay before the next attempt, or `undefined` when the response is not
 * retried: `Retry-After` when the server sends a usable one, otherwise
 * exponential backoff with jitter for 502/503. A 429 without `Retry-After`
 * is not retried, nor is a 502 for a non-replayable request: a gateway may
 * answer 502 after the backend already processed it.
 */
function retryDelayMs(
  response: Response,
  attempt: number,
  replayable: boolean,
  random: () => number
): number | undefined {
  if (!RETRYABLE_STATUSES.has(response.status)) return undefined
  if (response.status === 502 && !replayable) return undefined

  const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
  if (retryAfter !== undefined) return retryAfter * 1000
  if (response.status === 429) return undefined

  return backoffMs(attempt, random)
}

/**
 * Retry requests after a 429 carrying `Retry-After`, a 503 or — for replayable
 * requests ({@link isReplayable}) — a 502 (using `Retry-After` when present,
 * exponential backoff otherwise), or a network failure (exponential backoff;
 * see {@link isRetryableFetchError}). A 503 whose body carries a
 * non-retryable `error_code` (a refused pause) is returned after one request;
 * the body is peeked at for an inspection budget of max(retry delay, 1 s)
 * within the remaining request budget.
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

      const delayMs = retryDelayMs(response, attempt, replayable, random)
      if (delayMs === undefined || monotonic() + delayMs >= deadline) {
        return response
      }

      // Peek at a 503 body for a non-retryable code for its own inspection
      // budget (at least the retry delay, within the remaining request
      // budget); the time spent peeking counts towards the delay.
      const peekStart = monotonic()
      if (
        await isNonRetryableRefusal(
          response,
          Math.min(Math.max(delayMs, PEEK_BUDGET_MS), deadline - peekStart),
          request.signal,
          sleep
        )
      ) {
        return response
      }
      const remainingDelayMs = Math.max(0, delayMs - (monotonic() - peekStart))
      if (monotonic() + remainingDelayMs >= deadline) return response

      // Not awaited: some fetch interceptors never settle `cancel()`, and the
      // retry does not depend on the discarded body having been released.
      void response.body?.cancel().catch(() => {})
      await sleep(remainingDelayMs, request.signal)
    }
  }) as typeof fetch
}
