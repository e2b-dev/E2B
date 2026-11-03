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
  maxConcurrentStreams?: number
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
// Node queues a request body in full against the HTTP/2 session's memory budget
// (`maxSessionMemory`, 10 MB) and resets whichever stream's response headers
// arrive while it is exhausted. envd REST carries file uploads, so streams of
// one session must not share that budget: one request per session, spread over
// `DEFAULT_ENVD_CONNECTION_LIMIT` sessions — the same shape undici 7 gave.
export const ENVD_MAX_CONCURRENT_STREAMS = 1

export function createEnvdFetchForRuntime(
  currentRuntime = runtime,
  options: EnvdFetchOptions = {}
): typeof fetch {
  return createRuntimeFetch(currentRuntime, () =>
    buildDispatchedFetch({
      connections: options.connectionLimit ?? DEFAULT_ENVD_CONNECTION_LIMIT,
      maxConcurrentStreams: options.maxConcurrentStreams,
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

  const envdFetch = createEnvdFetchForRuntime(runtime, {
    maxConcurrentStreams: ENVD_MAX_CONCURRENT_STREAMS,
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
