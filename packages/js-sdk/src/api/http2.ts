import { runtime } from '../utils'
import {
  loadUndici,
  type UndiciModule,
  type UndiciRequestInit,
} from '../undici'

const API_CONNECTION_LIMIT = 100
const API_UNDICI_FALLBACK_WARNING =
  'Failed to load undici for API HTTP/2 transport; falling back to global fetch.'

let apiFetch: typeof fetch | undefined
let hasWarnedUndiciFallback = false

export function createApiFetch(): typeof fetch {
  if (apiFetch) {
    return apiFetch
  }

  apiFetch = createApiFetchForRuntime(runtime)

  return apiFetch
}

export function createApiFetchForRuntime(
  currentRuntime = runtime,
  options: {
    connectionLimit?: number
    loadUndici?: () => Promise<UndiciModule | undefined>
  } = { connectionLimit: API_CONNECTION_LIMIT }
): typeof fetch {
  if (currentRuntime !== 'node') {
    return fetch
  }

  let fetcherPromise: Promise<typeof fetch> | undefined

  return (async (input, init) => {
    fetcherPromise ??= buildApiFetcher(options)
    const fetcher = await fetcherPromise

    return fetcher(input, init)
  }) as typeof fetch
}

async function buildApiFetcher(options: {
  connectionLimit?: number
  loadUndici?: () => Promise<UndiciModule | undefined>
}): Promise<typeof fetch> {
  const undici = await (options.loadUndici ?? loadUndici)()

  if (!undici) {
    warnUndiciFallback()

    return fetch
  }

  const { Agent, fetch: undiciFetch } = undici
  const dispatcher = new Agent({
    allowH2: true,
    connections: options.connectionLimit,
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

function warnUndiciFallback() {
  if (hasWarnedUndiciFallback) {
    return
  }

  hasWarnedUndiciFallback = true
  console.warn(API_UNDICI_FALLBACK_WARNING)
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
