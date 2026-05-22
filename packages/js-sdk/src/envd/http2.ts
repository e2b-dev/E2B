import { runtime } from '../utils'
import {
  loadUndici,
  toUndiciRequestInput,
  type UndiciModule,
  type UndiciRequestInit,
} from '../undici'

type EnvdFetchOptions = {
  connectionLimit?: number
  loadUndici?: () => Promise<UndiciModule | undefined>
}

let envdFetch: typeof fetch | undefined
let envdRpcFetch: typeof fetch | undefined
let hasWarnedUndiciFallback = false
const ENVD_RPC_CONNECTION_LIMIT = 100

export function createEnvdFetchForRuntime(
  currentRuntime = runtime,
  options: EnvdFetchOptions = { connectionLimit: 1 }
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

  if (!undici) {
    warnUndiciFallback()

    return fetch
  }

  const { Agent, fetch: undiciFetch } = undici
  const dispatcherOptions: { allowH2: true; connections?: number } = {
    allowH2: true,
  }
  if (options.connectionLimit !== undefined) {
    dispatcherOptions.connections = options.connectionLimit
  }

  const dispatcher = new Agent(dispatcherOptions)
  const fetchWithDispatcher = undiciFetch as unknown as (
    input: RequestInfo | URL,
    init?: UndiciRequestInit
  ) => Promise<Response>

  return ((input, init) => {
    const request = toUndiciRequestInput(input, init)

    return fetchWithDispatcher(request.input, {
      ...request.init,
      dispatcher,
    })
  }) as typeof fetch
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
  envdFetch = createEnvdFetchForRuntime(runtime)

  return envdFetch
}

export function createEnvdRpcFetch(): typeof fetch {
  if (envdRpcFetch) {
    return envdRpcFetch
  }

  envdRpcFetch = createEnvdFetchForRuntime(runtime, {
    connectionLimit: ENVD_RPC_CONNECTION_LIMIT,
  })

  return envdRpcFetch
}
