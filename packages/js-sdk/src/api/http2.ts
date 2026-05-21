import { runtime } from '../utils'
import {
  loadUndici,
  toUndiciRequestInput,
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
  console.warn(API_UNDICI_FALLBACK_WARNING)
}
