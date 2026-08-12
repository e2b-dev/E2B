import { runtime } from '../utils'
import { parseInflightLimitEnv, parsePositiveIntEnv } from '../api/metadata'
import {
  buildDispatchedFetch,
  createRuntimeFetch,
  type UndiciModule,
} from '../undici'

type EnvdFetchOptions = {
  connectionLimit?: number
  inflightLimit?: number
  proxy?: string
  loadUndici?: () => Promise<UndiciModule | undefined>
}

// Fetchers are cached per proxy so requests without a proxy keep sharing a
// single dispatcher while each distinct proxy URL gets its own.
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
  return createRuntimeFetch(currentRuntime, () =>
    buildDispatchedFetch({
      connections: options.connectionLimit ?? DEFAULT_ENVD_CONNECTION_LIMIT,
      inflightLimit: options.inflightLimit ?? 0,
      proxy: options.proxy,
      loadUndici: options.loadUndici,
    })
  )
}

export function createEnvdFetch(proxy?: string): typeof fetch {
  const key = proxy ?? ''

  const cached = envdFetchers.get(key)
  if (cached) {
    return cached
  }

  // Keep one origin connection for short envd REST calls. If ALPN falls back
  // to h1, this favors connection pressure over per-sandbox throughput.
  const envdFetch = createEnvdFetchForRuntime(runtime, {
    inflightLimit: getEnvdInflightLimit(),
    proxy,
  })
  envdFetchers.set(key, envdFetch)

  return envdFetch
}

export function createEnvdRpcFetch(proxy?: string): typeof fetch {
  const key = proxy ?? ''

  const cached = envdRpcFetchers.get(key)
  if (cached) {
    return cached
  }

  const envdRpcFetch = createEnvdFetchForRuntime(runtime, {
    connectionLimit: getEnvdRpcConnectionLimit(),
    inflightLimit: getEnvdRpcInflightLimit(),
    proxy,
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
