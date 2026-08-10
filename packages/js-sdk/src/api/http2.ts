import { runtime } from '../utils'
import { parseInflightLimitEnv, parsePositiveIntEnv } from './metadata'
import {
  buildDispatchedFetch,
  createRuntimeFetch,
  transportCacheKey,
  type FetchTransportOpts,
  type UndiciModule,
} from '../undici'

const DEFAULT_API_CONNECTION_LIMIT = 100
// 1000 = ~10 streams per connection (with the 100-conn default).
// Override via env if your workload needs different.
const DEFAULT_API_INFLIGHT_LIMIT = 1000

// Fetchers are cached per proxy and CA bundle so requests with the default
// connection options keep sharing a single dispatcher while each distinct
// combination gets its own.
const apiFetchers = new Map<string, typeof fetch>()

export function createApiFetch(options: FetchTransportOpts = {}): typeof fetch {
  const key = transportCacheKey(options)

  const cached = apiFetchers.get(key)
  if (cached) {
    return cached
  }

  const apiFetch = createApiFetchForRuntime(runtime, options)
  apiFetchers.set(key, apiFetch)

  return apiFetch
}

export function createApiFetchForRuntime(
  currentRuntime = runtime,
  options: FetchTransportOpts & {
    connectionLimit?: number
    inflightLimit?: number
    loadUndici?: () => Promise<UndiciModule | undefined>
  } = {}
): typeof fetch {
  // Defaults resolve inside the thunk so env vars are read lazily, at the
  // first request rather than at factory creation.
  return createRuntimeFetch(
    currentRuntime,
    () =>
      buildDispatchedFetch({
        connections: options.connectionLimit ?? getApiConnectionLimit(),
        inflightLimit: options.inflightLimit ?? getApiInflightLimit(),
        proxy: options.proxy,
        caBundle: options.caBundle,
        loadUndici: options.loadUndici,
      }),
    options
  )
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
 * Defaults to `1000` ({@link DEFAULT_API_INFLIGHT_LIMIT}). Override via
 * `E2B_API_INFLIGHT_REQUESTS` env var; set to `0` to disable the cap entirely.
 */
export function getApiInflightLimit(): number {
  return parseInflightLimitEnv(
    'E2B_API_INFLIGHT_REQUESTS',
    DEFAULT_API_INFLIGHT_LIMIT
  )
}
