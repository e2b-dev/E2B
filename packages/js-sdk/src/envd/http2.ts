import { runtime } from '../utils'
import { parseInflightLimitEnv, parsePositiveIntEnv } from '../api/metadata'
import { limitConcurrency } from '../api/inflight'
import {
  loadUndici,
  toUndiciRequestInput,
  type UndiciModule,
  type UndiciRequestInit,
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
  if (currentRuntime !== 'node') {
    return fetch
  }

  let fetcherPromise: Promise<typeof fetch> | undefined

  return (async (input, init) => {
    fetcherPromise ??= buildEnvdFetcher(options)
    const fetcher = await fetcherPromise

    return fetcher(input, init)
  }) as typeof fetch
}

async function buildEnvdFetcher(
  options: EnvdFetchOptions
): Promise<typeof fetch> {
  const undici = await (options.loadUndici ?? loadUndici)()
  const inflightLimit = options.inflightLimit ?? 0

  if (!undici) {
    return limitConcurrency(fetch, inflightLimit)
  }

  const { Agent, ProxyAgent, fetch: undiciFetch } = undici
  const connections = options.connectionLimit ?? DEFAULT_ENVD_CONNECTION_LIMIT

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

  return limitConcurrency(wrapped, inflightLimit)
}

export function createEnvdFetch(proxy?: string): typeof fetch {
  const key = proxy ?? ''

  const cached = envdFetchers.get(key)
  if (cached) {
    return cached
  }

  const envdFetch = createEnvdFetchForRuntime(runtime, {
    connectionLimit: getEnvdConnectionLimit(),
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

export function getEnvdConnectionLimit(): number {
  return parsePositiveIntEnv(
    'E2B_ENVD_CONNECTIONS',
    DEFAULT_ENVD_CONNECTION_LIMIT
  )
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
 * Defaults to {@link DEFAULT_ENVD_INFLIGHT_LIMIT} ({@link 2000}). Override
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
 * Defaults to {@link DEFAULT_ENVD_RPC_INFLIGHT_LIMIT} ({@link 2000}). Override
 * via `E2B_ENVD_RPC_INFLIGHT_REQUESTS` env var; set to `0` to disable the cap
 * entirely.
 */
export function getEnvdRpcInflightLimit(): number {
  return parseInflightLimitEnv(
    'E2B_ENVD_RPC_INFLIGHT_REQUESTS',
    DEFAULT_ENVD_RPC_INFLIGHT_LIMIT
  )
}
