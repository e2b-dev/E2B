import { runtime } from '../utils'

type UndiciDispatcher = unknown
type UndiciRequestInit = RequestInit & {
  dispatcher: UndiciDispatcher
  duplex?: 'half'
}
type UndiciModule = {
  Agent: new (options: { allowH2: true; connections?: number }) => unknown
  fetch: unknown
}
type EnvdFetchOptions = {
  connectionLimit?: number
}
type EnvdFetchClient = {
  dispatcher: UndiciDispatcher
  fetchWithDispatcher: (
    input: RequestInfo | URL,
    init?: UndiciRequestInit
  ) => Promise<Response>
}

let envdFetch: typeof fetch | undefined
let envdRpcFetch: typeof fetch | undefined

export function createEnvdFetchForRuntime(
  currentRuntime = runtime,
  options: EnvdFetchOptions = { connectionLimit: 1 }
): typeof fetch {
  if (currentRuntime !== 'node') {
    return fetch
  }

  let clientPromise: Promise<EnvdFetchClient> | undefined

  return (async (input, init) => {
    clientPromise ??= createUndiciClient(options)
    const { dispatcher, fetchWithDispatcher } = await clientPromise
    const request = toRequestInput(input, init)

    return fetchWithDispatcher(request.input, {
      ...request.init,
      dispatcher,
    })
  }) as typeof fetch
}

async function createUndiciClient(
  options: EnvdFetchOptions
): Promise<EnvdFetchClient> {
  const { Agent, fetch: undiciFetch } = (await import(
    /* webpackIgnore: true */
    /* @vite-ignore */
    'undici'
  )) as UndiciModule
  const dispatcherOptions: { allowH2: true; connections?: number } = {
    allowH2: true,
  }
  if (options.connectionLimit !== undefined) {
    dispatcherOptions.connections = options.connectionLimit
  }

  return {
    dispatcher: new Agent(dispatcherOptions),
    fetchWithDispatcher: undiciFetch as unknown as (
      input: RequestInfo | URL,
      init?: UndiciRequestInit
    ) => Promise<Response>,
  }
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
