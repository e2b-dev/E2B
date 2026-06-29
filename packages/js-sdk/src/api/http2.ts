import { runtime } from '../utils'
import { parseInflightLimitEnv, parseIntEnv, parsePositiveIntEnv } from './metadata'
import { limitConcurrency } from './inflight'
import {
  loadUndici,
  toUndiciRequestInput,
  type UndiciModule,
  type UndiciRequestInit,
} from '../undici'

const DEFAULT_API_CONNECTION_LIMIT = 100
const DEFAULT_REQUEST_RETRIES = 3
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504])
// 1000 = ~10 streams per connection (with the 100-conn default).
// Override via env if your workload needs different.
const DEFAULT_API_INFLIGHT_LIMIT = 1000

// Fetchers are cached per proxy so requests without a proxy keep sharing a
// single dispatcher while each distinct proxy URL gets its own.
const apiFetchers = new Map<string, typeof fetch>()

export function createApiFetch(proxy?: string): typeof fetch {
  const key = proxy ?? ''

  const cached = apiFetchers.get(key)
  if (cached) {
    return cached
  }

  const apiFetch = createApiFetchForRuntime(runtime, { proxy })
  apiFetchers.set(key, apiFetch)

  return apiFetch
}

export function createApiFetchForRuntime(
  currentRuntime = runtime,
  options: {
    connectionLimit?: number
    inflightLimit?: number
    proxy?: string
    loadUndici?: () => Promise<UndiciModule | undefined>
  } = {}
): typeof fetch {
  if (currentRuntime !== 'node') {
    return fetch
  }

  let fetcherPromise: Promise<typeof fetch> | undefined

  return (async (input, init) => {
    fetcherPromise ??= buildApiFetcher(options)
    const fetcher = await fetcherPromise

    return fetcher(input, init)
  }) as typeof fetch
}

async function buildApiFetcher(options: {
  connectionLimit?: number
  inflightLimit?: number
  proxy?: string
  loadUndici?: () => Promise<UndiciModule | undefined>
}): Promise<typeof fetch> {
  const undici = await (options.loadUndici ?? loadUndici)()
  const inflightLimit = options.inflightLimit ?? getApiInflightLimit()

  if (!undici) {
    return limitConcurrency(withRetry(fetch), inflightLimit)
  }

  const { Agent, ProxyAgent, fetch: undiciFetch } = undici
  const connections = options.connectionLimit ?? getApiConnectionLimit()
  const dispatcher = options.proxy
    ? new ProxyAgent({
      uri: options.proxy,
      allowH2: true,
      connections,
    })
    : new Agent({
      allowH2: true,
      connections,
    })
  const fetchWithDispatcher = undiciFetch as unknown as (
    input: RequestInfo | URL,
    init?: UndiciRequestInit
  ) => Promise<Response>

  const wrapped: typeof fetch = ((input, init) => {
    const request = toUndiciRequestInput(input, init)

    return fetchWithDispatcher(request.input, {
      ...request.init,
      dispatcher,
    })
  }) as typeof fetch

  return limitConcurrency(withRetry(wrapped), inflightLimit)
}

function getRequestRetries(): number {
  return parseIntEnv('E2B_REQUEST_RETRIES', DEFAULT_REQUEST_RETRIES)
}

export function withRetry(baseFetch: typeof fetch): typeof fetch {
  const maxRetries = getRequestRetries()
  if (maxRetries <= 0) return baseFetch

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await baseFetch(input, init)
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxRetries) {
          // Consume the body before retrying
          await response.text().catch(() => { })
          await sleep(Math.min(2 ** attempt * 1000, 8000))
          continue
        }
        return response
      } catch (error: unknown) {
        lastError = error
        // Don't retry abort/timeout errors
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        if (attempt < maxRetries) {
          await sleep(Math.min(2 ** attempt * 1000, 8000))
          continue
        }
        throw error
      }
    }
    throw lastError
  }) as typeof fetch
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getApiConnectionLimit(): number {
  return parsePositiveIntEnv(
    'E2B_API_CONNECTIONS',
    DEFAULT_API_CONNECTION_LIMIT
  )
}

/**
 * Returns the configured max number of API requests that can be in flight at
 * once, or `0` to disable the cap.
 *
 * Defaults to {@link DEFAULT_API_INFLIGHT_LIMIT} ({@link 1000}). Override via
 * `E2B_API_INFLIGHT_REQUESTS` env var; set to `0` to disable the cap entirely.
 */
export function getApiInflightLimit(): number {
  return parseInflightLimitEnv(
    'E2B_API_INFLIGHT_REQUESTS',
    DEFAULT_API_INFLIGHT_LIMIT
  )
}
