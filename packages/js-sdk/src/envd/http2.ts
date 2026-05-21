import { runtime } from '../utils'
import {
  loadUndici,
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
    const request = toRequestInput(input, init)

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

  // RPC streams can stay open while follow-up RPCs run against the same
  // sandbox, so they cannot share the REST client's single-connection cap.
  envdRpcFetch = createEnvdFetchForRuntime(runtime, {})

  return envdRpcFetch
}

function toRequestInput(
  input: RequestInfo | URL,
  init?: RequestInit
): { input: RequestInfo | URL; init?: RequestInit & { duplex?: 'half' } } {
  if (!(input instanceof Request)) {
    return { input, init }
  }

  const requestInit: RequestInit & { duplex?: 'half' } = {
    body: input.body,
    cache: input.cache,
    credentials: input.credentials,
    headers: input.headers,
    integrity: input.integrity,
    keepalive: input.keepalive,
    method: input.method,
    mode: input.mode,
    redirect: input.redirect,
    referrer: input.referrer,
    referrerPolicy: input.referrerPolicy,
    signal: input.signal,
    ...init,
  }

  if (requestInit.body) {
    requestInit.duplex = 'half'
  }

  return {
    input: input.url,
    init: requestInit,
  }
}
