import { runtime } from '../utils'
import { DEFAULT_HTTP_VERSION, type HttpVersion } from '../connectionConfig'
import { parsePositiveIntEnv } from './metadata'
import {
  buildDispatchedFetch,
  createRuntimeFetch,
  type UndiciModule,
} from '../undici'

const DEFAULT_API_CONNECTION_LIMIT = 100

// Fetchers are cached per proxy and HTTP version so requests without a proxy
// keep sharing a single dispatcher while each distinct proxy URL gets its own.
const apiFetchers = new Map<string, typeof fetch>()

export interface FetchOpts {
  proxy?: string
  httpVersion?: HttpVersion
}

export function createApiFetch({
  proxy,
  httpVersion = DEFAULT_HTTP_VERSION,
}: FetchOpts = {}): typeof fetch {
  const key = `${httpVersion}:${proxy ?? ''}`

  const cached = apiFetchers.get(key)
  if (cached) {
    return cached
  }

  const apiFetch = createApiFetchForRuntime(runtime, { proxy, httpVersion })
  apiFetchers.set(key, apiFetch)

  return apiFetch
}

export function createApiFetchForRuntime(
  currentRuntime = runtime,
  options: {
    connectionLimit?: number
    proxy?: string
    httpVersion?: HttpVersion
    loadUndici?: () => Promise<UndiciModule | undefined>
  } = {}
): typeof fetch {
  // Defaults resolve inside the thunk so env vars are read lazily, at the
  // first request rather than at factory creation.
  return createRuntimeFetch(currentRuntime, () =>
    buildDispatchedFetch({
      connections: options.connectionLimit ?? getApiConnectionLimit(),
      proxy: options.proxy,
      httpVersion: options.httpVersion,
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
