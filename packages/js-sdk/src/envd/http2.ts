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
  loadUndici?: () => Promise<UndiciModule | undefined>
}

let envdFetch: typeof fetch | undefined
let envdRpcFetch: typeof fetch | undefined
let hasWarnedUndiciFallback = false
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
    warnUndiciFallback()

    return limitConcurrency(fetch, inflightLimit)
  }

  const { Agent, fetch: undiciFetch } = undici
  const dispatcherOptions: { allowH2: true; connections?: number } = {
    allowH2: true,
    connections: options.connectionLimit ?? DEFAULT_ENVD_CONNECTION_LIMIT,
  }

  const dispatcher = new Agent(dispatcherOptions)
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

function warnUndiciFallback() {
  if (hasWarnedUndiciFallback) {
    return
  }

  hasWarnedUndiciFallback = true
  console.warn(
    'Failed to load undici for envd HTTP/2 transport; falling back to global fetch.'
  )
}

export function createEnvdFetch(): typeof fetch {
  if (envdFetch) {
    return envdFetch
  }

  // Keep one origin connection for short envd REST calls. If ALPN falls back
  // to h1, this favors connection pressure over per-sandbox throughput.
  envdFetch = createEnvdFetchForRuntime(runtime, {
    inflightLimit: getEnvdInflightLimit(),
  })

  return envdFetch
}

export function createEnvdRpcFetch(): typeof fetch {
  if (envdRpcFetch) {
    return envdRpcFetch
  }

  envdRpcFetch = createEnvdFetchForRuntime(runtime, {
    connectionLimit: getEnvdRpcConnectionLimit(),
    inflightLimit: getEnvdRpcInflightLimit(),
  })

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
