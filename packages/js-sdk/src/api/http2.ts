import { runtime } from '../utils'
import {
  DEFAULT_HTTP_VERSION,
  resolveConnectionRetries,
  type HttpVersion,
} from '../connectionConfig'
import { parseInflightLimitEnv, parsePositiveIntEnv } from './metadata'
import {
  buildDispatchedFetch,
  createRuntimeFetch,
  type UndiciModule,
} from '../undici'

const DEFAULT_API_CONNECTION_LIMIT = 100
// 1000 = ~10 streams per connection (with the 100-conn default).
// Override via env if your workload needs different.
const DEFAULT_API_INFLIGHT_LIMIT = 1000

// Fetchers are cached per proxy, HTTP version and connection retry count so
// requests without a proxy keep sharing a single dispatcher while each
// distinct proxy URL gets its own.
const apiFetchers = new Map<string, typeof fetch>()

/**
 * Options of the shared fetchers: `connectionRetries` is the number of
 * connection attempts after the first for sockets that cannot be established
 * (Node only; see `buildDispatchedFetch`), `ConnectionConfig.connectionRetries`
 * i.e. `E2B_CONNECTION_RETRIES`.
 */
export interface FetchOpts {
  proxy?: string
  httpVersion?: HttpVersion
  connectionRetries?: number
}

function fetcherKey(
  proxy: string | undefined,
  httpVersion: HttpVersion,
  retries: number
): string {
  return `${httpVersion}:${retries}:${proxy ?? ''}`
}

export function createApiFetch({
  proxy,
  httpVersion = DEFAULT_HTTP_VERSION,
  connectionRetries = resolveConnectionRetries(),
}: FetchOpts = {}): typeof fetch {
  const key = fetcherKey(proxy, httpVersion, connectionRetries)

  const cached = apiFetchers.get(key)
  if (cached) {
    return cached
  }

  const apiFetch = createApiFetchForRuntime(runtime, {
    proxy,
    httpVersion,
    connectRetries: connectionRetries,
  })
  apiFetchers.set(key, apiFetch)

  return apiFetch
}

export function createApiFetchForRuntime(
  currentRuntime = runtime,
  options: {
    connectionLimit?: number
    inflightLimit?: number
    proxy?: string
    httpVersion?: HttpVersion
    connectRetries?: number
    loadUndici?: () => Promise<UndiciModule | undefined>
  } = {}
): typeof fetch {
  // Defaults resolve inside the thunk so env vars are read lazily, at the
  // first request rather than at factory creation.
  return createRuntimeFetch(currentRuntime, () =>
    buildDispatchedFetch({
      connections: options.connectionLimit ?? getApiConnectionLimit(),
      inflightLimit: options.inflightLimit ?? getApiInflightLimit(),
      proxy: options.proxy,
      httpVersion: options.httpVersion,
      connectRetries: options.connectRetries,
      loadUndici: options.loadUndici,
    })
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
