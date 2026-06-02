import { parseIntEnv } from './api/metadata'

/** Default number of *retries* (i.e. attempts after the first). */
export const DEFAULT_MAX_RETRIES = 3

/** Base for the exponential backoff, in milliseconds. */
const DEFAULT_BACKOFF_BASE_MS = 500
/** Upper bound for a single backoff delay, in milliseconds. */
const DEFAULT_BACKOFF_CAP_MS = 8_000
/**
 * Upper bound (in bytes) on request bodies we are willing to buffer in memory
 * so the request can be replayed across retries. Larger bodies (e.g. file
 * uploads) are sent once and not retried.
 */
const MAX_REPLAYABLE_BODY_BYTES = 1024 * 1024 // 1 MiB

/**
 * HTTP methods that are idempotent per the HTTP spec and can therefore be
 * retried on any transient failure.
 */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])

/**
 * A transient failure is either:
 *  - `rejected`: the server demonstrably did NOT process the request (e.g. it
 *    was throttled, or the connection never reached the server). Replaying is
 *    always safe, even for non-idempotent requests.
 *  - `ambiguous`: the request may or may not have been processed (e.g. the
 *    connection dropped after sending). Replaying is only safe for idempotent
 *    requests.
 */
type FailureKind = 'rejected' | 'ambiguous'

/**
 * HTTP status codes that indicate a transient failure worth retrying, mapped to
 * whether the request was definitely not processed (`rejected`) or might have
 * been (`ambiguous`).
 *
 * `500` is intentionally excluded because it is frequently a deterministic
 * server-side error rather than a transient one.
 */
const RETRYABLE_STATUS: Map<number, FailureKind> = new Map([
  [408, 'ambiguous'], // request timeout
  [429, 'rejected'], // throttled — not processed
  [502, 'ambiguous'], // bad gateway
  [503, 'rejected'], // service unavailable — not processed
  [504, 'ambiguous'], // gateway timeout
])

/**
 * Lower-cased error codes (from `error.code` or `error.cause.code`) that
 * indicate a transient, connection-level failure that is safe to retry, mapped
 * to whether the request could have reached the server.
 */
const RETRYABLE_ERROR_CODES: Map<string, FailureKind> = new Map([
  ['econnrefused', 'rejected'], // never accepted the connection
  ['enotfound', 'rejected'], // DNS failure — never reached server
  ['eai_again', 'rejected'], // DNS failure — never reached server
  ['enetunreach', 'rejected'],
  ['ehostunreach', 'rejected'],
  ['econnreset', 'ambiguous'], // dropped mid-flight
  ['epipe', 'ambiguous'],
  ['etimedout', 'ambiguous'],
])

export interface RetryPolicy {
  /** Number of retries (attempts after the first). `0` disables retries. */
  retries: number
  backoffBaseMs: number
  backoffCapMs: number
}

/**
 * Resolve the configured number of retries, falling back to the
 * `E2B_MAX_RETRIES` environment variable and finally
 * {@link DEFAULT_MAX_RETRIES}.
 */
export function resolveMaxRetries(retries?: number): number {
  if (retries !== undefined) {
    if (!Number.isInteger(retries) || retries < 0) {
      throw new Error(
        `Invalid retries=${retries}: expected a non-negative integer.`
      )
    }
    return retries
  }

  const fromEnv = parseIntEnv('E2B_MAX_RETRIES', DEFAULT_MAX_RETRIES)
  if (fromEnv < 0) {
    throw new Error(
      `Invalid E2B_MAX_RETRIES=${fromEnv}: expected a non-negative integer.`
    )
  }
  return fromEnv
}

function defaultPolicy(retries: number): RetryPolicy {
  return {
    retries,
    backoffBaseMs: DEFAULT_BACKOFF_BASE_MS,
    backoffCapMs: DEFAULT_BACKOFF_CAP_MS,
  }
}

/**
 * Parse a `Retry-After` header value (either delta-seconds or an HTTP date)
 * into a delay in milliseconds. Returns `undefined` when the value is missing
 * or unparseable.
 */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now()
): number | undefined {
  if (!value) return undefined

  const trimmed = value.trim()
  // delta-seconds form
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) * 1000
  }

  // HTTP-date form
  const date = Date.parse(trimmed)
  if (!Number.isNaN(date)) {
    return Math.max(0, date - now)
  }

  return undefined
}

/**
 * Compute the delay before the next attempt. A server-provided `Retry-After`
 * takes precedence; otherwise an exponential backoff with full jitter is used.
 */
export function computeDelayMs(
  attempt: number,
  policy: RetryPolicy,
  response?: Response
): number {
  const retryAfter = parseRetryAfter(
    response?.headers.get('retry-after') ?? null
  )
  if (retryAfter !== undefined) {
    return Math.min(retryAfter, policy.backoffCapMs * 4)
  }

  const exp = Math.min(policy.backoffCapMs, policy.backoffBaseMs * 2 ** attempt)
  // Full jitter: a random value in [0, exp].
  return Math.random() * exp
}

function retryableStatusKind(status: number): FailureKind | undefined {
  return RETRYABLE_STATUS.get(status)
}

/**
 * Classify a thrown error as a transient, connection-level failure (returning
 * its {@link FailureKind}) or `undefined` when it is not retryable. User/timeout
 * aborts are explicitly not retryable.
 */
export function retryableErrorKind(err: unknown): FailureKind | undefined {
  if (isAbortError(err)) return undefined

  const codes: string[] = []
  let current: unknown = err
  // Walk the `cause` chain (undici wraps the real error in `cause`).
  for (let i = 0; i < 5 && current; i++) {
    const e = current as { code?: unknown; cause?: unknown; name?: unknown }
    if (typeof e.code === 'string') codes.push(e.code.toLowerCase())
    if (typeof e.name === 'string') codes.push(e.name.toLowerCase())
    current = e.cause
  }

  for (const code of codes) {
    const kind = RETRYABLE_ERROR_CODES.get(code)
    if (kind) return kind
    // undici low-level socket/transport errors are ambiguous mid-flight drops.
    if (code.startsWith('und_err_') || code === 'fetch failed') {
      return 'ambiguous'
    }
  }

  return undefined
}

/**
 * Decide whether a failure of the given kind may be retried for this request.
 * `rejected` failures are always safe; `ambiguous` failures are only safe for
 * idempotent requests.
 */
function mayRetry(kind: FailureKind, idempotent: boolean): boolean {
  if (kind === 'rejected') return true
  return idempotent
}

function isAbortError(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name
  return name === 'AbortError' || name === 'TimeoutError'
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function isStreamLike(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { getReader?: unknown }).getReader === 'function'
  )
}

/**
 * Buffer a request body up to {@link MAX_REPLAYABLE_BODY_BYTES} so the request
 * can be replayed across retries. Reads the (cloned) body incrementally and
 * bails out as soon as the cap is exceeded so we never buffer large uploads in
 * memory. Returns `undefined` body for bodyless requests, and
 * `replayable: false` when the body is too large to buffer safely (in which
 * case the request is sent once, without retries).
 */
async function bufferBody(
  request: Request
): Promise<{ replayable: boolean; body?: Uint8Array }> {
  if (
    request.body === null ||
    request.method === 'GET' ||
    request.method === 'HEAD'
  ) {
    return { replayable: true }
  }

  try {
    const reader = request.clone().body!.getReader()
    const chunks: Uint8Array[] = []
    let total = 0

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_REPLAYABLE_BODY_BYTES) {
        await reader.cancel().catch(() => {})
        return { replayable: false }
      }
      chunks.push(value)
    }

    const body = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { replayable: true, body }
  } catch {
    // Body could not be buffered (e.g. a one-shot stream) — do not retry.
    return { replayable: false }
  }
}

/**
 * Wrap a `fetch` implementation with automatic retries for transient failures.
 *
 * Behavior:
 *  - Retries on transient HTTP statuses ({@link RETRYABLE_STATUS}) and
 *    connection-level errors ({@link retryableErrorKind}).
 *  - Honors a server-provided `Retry-After` header; otherwise uses exponential
 *    backoff with full jitter.
 *  - Idempotent methods are retried on any transient failure. Non-idempotent
 *    methods (e.g. `POST`) are only retried on `rejected` failures where the
 *    server provably did not process the request. The request body is buffered
 *    (up to {@link MAX_REPLAYABLE_BODY_BYTES}) so it can be replayed.
 *  - Respects the request's `AbortSignal`: aborts (including request-timeout
 *    aborts) stop retrying immediately and the total timeout bounds the whole
 *    operation, not each attempt.
 *
 * @param innerFetch the underlying fetch to wrap
 * @param retries the number of retries, resolved via {@link resolveMaxRetries}
 *   by the caller; `0` disables retries (the inner fetch is returned unwrapped).
 */
export function withRetry(
  innerFetch: typeof fetch,
  retries: number
): typeof fetch {
  const policy = defaultPolicy(retries)

  if (policy.retries <= 0) {
    return innerFetch
  }

  return (async (input, init) => {
    // A raw streaming body (e.g. connect-web server/bidi streams) cannot be
    // replayed and would throw when constructing a Request without `duplex`.
    // Send it once, unwrapped.
    if (isStreamLike(init?.body)) {
      return innerFetch(input, init)
    }

    const request = new Request(input as RequestInfo, init)
    const method = request.method.toUpperCase()
    const idempotent = IDEMPOTENT_METHODS.has(method)

    const { replayable, body } = await bufferBody(request)

    // If we cannot safely replay the body, fall back to a single attempt.
    // Forward the already-constructed `request` (not `input`/`init`), since
    // constructing `request` above may have transferred/disturbed the original
    // input's body.
    if (!replayable) {
      return innerFetch(request)
    }

    const buildAttempt = (): Request =>
      body !== undefined ? new Request(request, { body }) : request.clone()

    let attempt = 0
    for (;;) {
      try {
        const response = await innerFetch(buildAttempt())

        const kind = retryableStatusKind(response.status)
        if (
          attempt >= policy.retries ||
          kind === undefined ||
          !mayRetry(kind, idempotent)
        ) {
          return response
        }

        // Drain and discard the body so the connection can be reused.
        await response.body?.cancel().catch(() => {})

        const delay = computeDelayMs(attempt, policy, response)
        await sleep(delay, request.signal)
        attempt++
      } catch (err) {
        const kind = retryableErrorKind(err)
        if (
          attempt >= policy.retries ||
          kind === undefined ||
          !mayRetry(kind, idempotent)
        ) {
          throw err
        }

        const delay = computeDelayMs(attempt, policy)
        await sleep(delay, request.signal)
        attempt++
      }
    }
  }) as typeof fetch
}
