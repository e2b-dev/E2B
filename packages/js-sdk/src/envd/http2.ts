import { runtime } from '../utils'
import { DEFAULT_HTTP_VERSION, type HttpVersion } from '../connectionConfig'
import type { FetchOpts } from '../api/http2'
import { parsePositiveIntEnv } from '../api/metadata'
import {
  buildDispatchedFetch,
  createRuntimeFetch,
  type UndiciModule,
} from '../undici'

type EnvdFetchOptions = {
  connectionLimit?: number
  proxy?: string
  httpVersion?: HttpVersion
  loadUndici?: () => Promise<UndiciModule | undefined>
}

// Fetchers are cached per proxy and HTTP version so requests without a proxy
// keep sharing a single dispatcher while each distinct proxy URL gets its own.
const envdFetchers = new Map<string, typeof fetch>()
const envdRpcFetchers = new Map<string, typeof fetch>()
const DEFAULT_ENVD_CONNECTION_LIMIT = 10
const DEFAULT_ENVD_RPC_CONNECTION_LIMIT = 200

export function createEnvdFetchForRuntime(
  currentRuntime = runtime,
  options: EnvdFetchOptions = {}
): typeof fetch {
  return createRuntimeFetch(currentRuntime, () =>
    buildDispatchedFetch({
      connections: options.connectionLimit ?? DEFAULT_ENVD_CONNECTION_LIMIT,
      proxy: options.proxy,
      httpVersion: options.httpVersion,
      loadUndici: options.loadUndici,
    })
  )
}

function fetcherKey(
  proxy: string | undefined,
  httpVersion: HttpVersion
): string {
  return `${httpVersion}:${proxy ?? ''}`
}

export function createEnvdFetch({
  proxy,
  httpVersion = DEFAULT_HTTP_VERSION,
}: FetchOpts = {}): typeof fetch {
  const key = fetcherKey(proxy, httpVersion)

  const cached = envdFetchers.get(key)
  if (cached) {
    return cached
  }

  // Keep one origin connection for short envd REST calls. If ALPN falls back
  // to h1, this favors connection pressure over per-sandbox throughput.
  const envdFetch = createEnvdFetchForRuntime(runtime, {
    proxy,
    httpVersion,
  })
  envdFetchers.set(key, envdFetch)

  return envdFetch
}

export function createEnvdRpcFetch({
  proxy,
  httpVersion = DEFAULT_HTTP_VERSION,
}: FetchOpts = {}): typeof fetch {
  const key = fetcherKey(proxy, httpVersion)

  const cached = envdRpcFetchers.get(key)
  if (cached) {
    return cached
  }

  const envdRpcFetch = createEnvdFetchForRuntime(runtime, {
    connectionLimit: getEnvdRpcConnectionLimit(),
    proxy,
    httpVersion,
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
