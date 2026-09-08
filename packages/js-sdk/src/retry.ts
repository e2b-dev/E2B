const MAX_RETRY_AFTER_SECONDS = 2_147_483

export function resolveRetries(retries?: number): number {
  if (retries === undefined) return 0
  if (!Number.isInteger(retries) || retries < 0) {
    throw new Error(
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
    if (retries === 0) return fetchImpl(input, init)

    const request = new Request(input as RequestInfo, init)
    const deadline = requestTimeoutMs
      ? monotonic() + requestTimeoutMs
      : undefined

    for (let attempt = 0; ; attempt++) {
      const response = await fetchImpl(request.clone())
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
      const delayMs = retryAfter === undefined ? undefined : retryAfter * 1000

      if (
        response.status !== 429 ||
        delayMs === undefined ||
        attempt === retries ||
        (deadline !== undefined && monotonic() + delayMs >= deadline)
      ) {
        return response
      }

      await response.body?.cancel().catch(() => {})
      await sleep(delayMs, request.signal)
    }
  }) as typeof fetch
}
