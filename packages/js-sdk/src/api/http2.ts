import { runtime } from '../utils'
import { getEnvVar } from './metadata'
import { limitConcurrency } from './inflight'
import {
  loadUndici,
  toUndiciRequestInput,
  type UndiciModule,
  type UndiciRequestInit,
} from '../undici'

const DEFAULT_API_CONNECTION_LIMIT = 100
// 1000 = ~10 streams per connection (with the 100-conn default).
// Override via env if your workload needs different.
const DEFAULT_API_INFLIGHT_LIMIT = 1000
const API_UNDICI_FALLBACK_WARNING =
  'Failed to load undici for API HTTP/2 transport; falling back to global fetch.'

let apiFetch: typeof fetch | undefined
let hasWarnedUndiciFallback = false

export function createApiFetch(): typeof fetch {
  if (apiFetch) {
    return apiFetch
  }

  apiFetch = createApiFetchForRuntime(runtime)

  return apiFetch
}

export function createApiFetchForRuntime(
  currentRuntime = runtime,
  options: {
    connectionLimit?: number
    inflightLimit?: number
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
  loadUndici?: () => Promise<UndiciModule | undefined>
}): Promise<typeof fetch> {
  const undici = await (options.loadUndici ?? loadUndici)()

  if (!undici) {
    warnUndiciFallback()

    return applyInflightLimit(fetch, options.inflightLimit)
  }

  const { Agent, fetch: undiciFetch } = undici
  const dispatcher = new Agent({
    allowH2: true,
    connections: options.connectionLimit ?? getApiConnectionLimit(),
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

  return applyInflightLimit(wrapped, options.inflightLimit)
}

function applyInflightLimit(
  fetcher: typeof fetch,
  override: number | undefined
): typeof fetch {
  const limit = override ?? getApiInflightLimit()
  if (limit == null) return fetcher
  return limitConcurrency(fetcher, limit)
}

export function getApiConnectionLimit(): number {
  const raw = getEnvVar('E2B_API_CONNECTIONS')
  if (!raw) return DEFAULT_API_CONNECTION_LIMIT

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1)
    return DEFAULT_API_CONNECTION_LIMIT

  return parsed
}

/**
 * Returns the configured max number of API requests that can be in flight at
 * once, or `null` to disable the cap.
 *
 * Defaults to {@link DEFAULT_API_INFLIGHT_LIMIT} ({@link 1000}). Override via
 * `E2B_API_INFLIGHT_REQUESTS` env var; set to `0` (or any non-positive value)
 * to disable the cap entirely.
 */
export function getApiInflightLimit(): number | null {
  const raw = getEnvVar('E2B_API_INFLIGHT_REQUESTS')
  if (!raw) return DEFAULT_API_INFLIGHT_LIMIT

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null

  return parsed
}

function warnUndiciFallback() {
  if (hasWarnedUndiciFallback) {
    return
  }

  hasWarnedUndiciFallback = true
  console.warn(API_UNDICI_FALLBACK_WARNING)
}
