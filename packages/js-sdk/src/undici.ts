import { compareVersions } from 'compare-versions'

import { limitConcurrency } from './api/inflight'
import { dynamicImport, isRequestLike } from './utils'

type UndiciRequestInit = RequestInit & {
  dispatcher?: unknown
  duplex?: 'half'
}

export type UndiciModule = {
  Agent: new (options: { allowH2: true; connections?: number }) => unknown
  ProxyAgent: new (options: {
    uri: string
    allowH2: true
    connections?: number
    proxyTunnel: true
  }) => unknown
  fetch: unknown
}

const UNDICI_8_MIN_NODE = '22.19.0'

export function getUndiciPackageCandidates(nodeVersion: string): string[] {
  if (compareVersions(nodeVersion, UNDICI_8_MIN_NODE) >= 0) {
    return ['undici8', 'undici']
  }

  return ['undici']
}

export async function loadUndici(): Promise<UndiciModule | undefined> {
  for (const packageName of getUndiciPackageCandidates(process.versions.node)) {
    try {
      return await dynamicImport<UndiciModule>(packageName)
    } catch {
      // Try the next package supported by this Node version.
    }
  }

  return undefined
}

/**
 * Late-bind the global fetch: runtimes and tools (msw, instrumentation) may
 * replace `globalThis.fetch` after the SDK builds a fetcher. A factory rather
 * than a shared const so per-proxy cache entries stay distinct closures.
 */
function lateBoundGlobalFetch(): typeof fetch {
  return ((input, init) => globalThis.fetch(input, init)) as typeof fetch
}

/**
 * Create a fetch for the given runtime. Outside Node it late-binds the global
 * fetch. On Node it lazily runs `build` on the first request and caches the
 * built fetcher; a failed build is not cached, so the next request retries
 * instead of replaying the same stale rejection forever.
 */
export function createRuntimeFetch(
  currentRuntime: string,
  build: () => Promise<typeof fetch>
): typeof fetch {
  if (currentRuntime !== 'node') {
    return lateBoundGlobalFetch()
  }

  let fetcherPromise: Promise<typeof fetch> | undefined

  return (async (input, init) => {
    const promise = (fetcherPromise ??= build())

    let fetcher: typeof fetch
    try {
      fetcher = await promise
    } catch (err) {
      // Clear only our own failed build: a stale awaiter of an already-
      // rejected promise must not clobber a newer in-flight build.
      if (fetcherPromise === promise) {
        fetcherPromise = undefined
      }
      throw err
    }

    return fetcher(input, init)
  }) as typeof fetch
}

/**
 * Build a fetch bound to a bounded undici dispatcher (HTTP/2 enabled,
 * `connections` origin connections, optional proxy tunnel), capped at
 * `inflightLimit` in-flight requests (`0` disables the cap). Falls back to
 * the global fetch — still capped — when undici cannot be loaded.
 */
export async function buildDispatchedFetch(options: {
  connections: number
  inflightLimit: number
  proxy?: string
  loadUndici?: () => Promise<UndiciModule | undefined>
}): Promise<typeof fetch> {
  const undici = await (options.loadUndici ?? loadUndici)()

  if (!undici) {
    return limitConcurrency(lateBoundGlobalFetch(), options.inflightLimit)
  }

  const { Agent, ProxyAgent, fetch: undiciFetch } = undici
  const dispatcher = options.proxy
    ? new ProxyAgent({
        uri: options.proxy,
        allowH2: true,
        connections: options.connections,
        proxyTunnel: true,
      })
    : new Agent({
        allowH2: true,
        connections: options.connections,
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

  return limitConcurrency(wrapped, options.inflightLimit)
}

function toUndiciRequestInput(
  input: RequestInfo | URL,
  init?: RequestInit
): { input: RequestInfo | URL; init?: RequestInit & { duplex?: 'half' } } {
  // Shape check, not `instanceof`: a Request minted by a replaced/duplicated
  // global Request class must still be destructured here — passed through
  // verbatim, undici's fetch would coerce it to a URL string and crash (see
  // isRequestLike).
  if (!isRequestLike(input)) {
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
