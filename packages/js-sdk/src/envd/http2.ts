import { runtime } from '../utils'
import { parseInflightLimitEnv, parsePositiveIntEnv } from '../api/metadata'
import {
  buildDispatchedFetch,
  createRuntimeFetch,
  transportCacheKey,
  type FetchTransportOpts,
  type UndiciModule,
} from '../undici'

type EnvdFetchOptions = FetchTransportOpts & {
  connectionLimit?: number
  inflightLimit?: number
  loadUndici?: () => Promise<UndiciModule | undefined>
}

// Fetchers are cached per proxy and CA bundle so requests with the default
// connection options keep sharing a single dispatcher while each distinct
// combination gets its own.
const envdFetchers = new Map<string, typeof fetch>()
const envdRpcFetchers = new Map<string, typeof fetch>()
const DEFAULT_ENVD_CONNECTION_LIMIT = 10
const DEFAULT_ENVD_RPC_CONNECTION_LIMIT = 200
const DEFAULT_ENVD_INFLIGHT_LIMIT = 2000
const DEFAULT_ENVD_RPC_INFLIGHT_LIMIT = 2000

export function createEnvdFetchForRuntime(
  currentRuntime = runtime,
  options: EnvdFetchOptions = {}
): typeof fetch {
  return createRuntimeFetch(
    currentRuntime,
    () =>
      buildDispatchedFetch({
        connections: options.connectionLimit ?? DEFAULT_ENVD_CONNECTION_LIMIT,
        inflightLimit: options.inflightLimit ?? 0,
        proxy: options.proxy,
        caBundle: options.caBundle,
        loadUndici: options.loadUndici,
      }),
    options
  )
}

export function createEnvdFetch(
  options: FetchTransportOpts = {}
): typeof fetch {
  const key = transportCacheKey(options)

  const cached = envdFetchers.get(key)
  if (cached) {
    return cached
  }

  // Keep one origin connection for short envd REST calls. If ALPN falls back
  // to h1, this favors connection pressure over per-sandbox throughput.
  const envdFetch = createEnvdFetchForRuntime(runtime, {
    ...options,
    inflightLimit: getEnvdInflightLimit(),
  })
  envdFetchers.set(key, envdFetch)

  return envdFetch
}

export function createEnvdRpcFetch(
  options: FetchTransportOpts = {}
): typeof fetch {
  const key = transportCacheKey(options)

  const cached = envdRpcFetchers.get(key)
  if (cached) {
    return cached
  }

  const envdRpcFetch = createEnvdFetchForRuntime(runtime, {
    ...options,
    connectionLimit: getEnvdRpcConnectionLimit(),
    inflightLimit: getEnvdRpcInflightLimit(),
  })
  envdRpcFetchers.set(key, envdRpcFetch)

  return envdRpcFetch
}

export function getEnvdRpcConnectionLimit(): number {
  return parsePositiveIntEnv(
    'E2B_ENVD_RPC_CONNECTIONS',
    DEFAULT_ENVD_RPC_CONNECTION_LIMIT
  )
}

/**
 * Returns the configured max number of envd REST requests (e.g.
 * `files.read`/`files.write`) that can be in flight at once across all
 * sandboxes in this SDK process, or `0` to disable the cap.
 *
 * Defaults to `2000` ({@link DEFAULT_ENVD_INFLIGHT_LIMIT}). Override
 * via `E2B_ENVD_INFLIGHT_REQUESTS` env var; set to `0` to disable the cap
 * entirely.
 */
export function getEnvdInflightLimit(): number {
  return parseInflightLimitEnv(
    'E2B_ENVD_INFLIGHT_REQUESTS',
    DEFAULT_ENVD_INFLIGHT_LIMIT
  )
}

/**
 * Returns the configured max number of envd RPC requests that
 * can be in flight at once across all sandboxes in this SDK process,
 * or `0` to disable the cap.
 *
 * Defaults to `2000` ({@link DEFAULT_ENVD_RPC_INFLIGHT_LIMIT}). Override
 * via `E2B_ENVD_RPC_INFLIGHT_REQUESTS` env var; set to `0` to disable the cap
 * entirely.
 */
export function getEnvdRpcInflightLimit(): number {
  return parseInflightLimitEnv(
    'E2B_ENVD_RPC_INFLIGHT_REQUESTS',
    DEFAULT_ENVD_RPC_INFLIGHT_LIMIT
  )
}
