import { dynamicRequire, runtime } from '../utils'

type Undici = typeof import('undici')
type UndiciDispatcher = InstanceType<Undici['Agent']>
type UndiciRequestInit = RequestInit & {
  dispatcher: UndiciDispatcher
  duplex?: 'half'
}

let envdFetch: typeof fetch | undefined

export function createEnvdFetchForRuntime(
  currentRuntime = runtime
): typeof fetch {
  if (currentRuntime !== 'node') {
    return fetch
  }

  const { Agent, fetch: undiciFetch } = dynamicRequire<Undici>('undici')
  const dispatcher = new Agent({
    allowH2: true,
    // Keep one origin connection for h2 multiplexing. If ALPN falls back to h1,
    // this favors connection pressure over per-sandbox throughput.
    connections: 1,
  })
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

export function createEnvdFetch(): typeof fetch {
  if (envdFetch) {
    return envdFetch
  }

  envdFetch = createEnvdFetchForRuntime(runtime)

  return envdFetch
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
