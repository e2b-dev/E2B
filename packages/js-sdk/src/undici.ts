import { compareVersions } from 'compare-versions'

import { isReadableStreamLike, isRequestLike } from './is'
import { dynamicImport, toDispatchableStream } from './utils'
import { DEFAULT_HTTP_VERSION, type HttpVersion } from './connectionConfig'

type UndiciRequestInit = RequestInit & {
  dispatcher?: unknown
  duplex?: 'half'
}

type UndiciDispatcher = { close(): Promise<void> }

type UndiciAgentOptions = {
  allowH2: boolean
  connections?: number
}

export type UndiciModule = {
  Agent: new (options: UndiciAgentOptions) => UndiciDispatcher
  ProxyAgent: new (
    options: UndiciAgentOptions & { uri: string; proxyTunnel: true }
  ) => UndiciDispatcher
  fetch: unknown
}

// Node's HTTP/2 client charges queued request-body bytes against a per-session
// memory budget (`maxSessionMemory`, 10 MB) and resets the stream whose
// response headers arrive while the budget is exhausted — with
// ENHANCE_YOUR_CALM, or INTERNAL_ERROR where the reset is deferred. Bytes of
// streams destroyed before they were flushed stay charged until the session
// closes (nodejs/node#67113), so such a reset marks the session as poisoned.
const POISONED_HTTP2_SESSION_RST =
  /NGHTTP2_(ENHANCE_YOUR_CALM|INTERNAL_ERROR)\b/

/**
 * Whether a `fetch` rejection is Node's HTTP/2 client resetting the stream
 * itself because the session's memory budget is exhausted. The session stays
 * unusable for every later request, so the dispatcher holding it must go.
 */
export function isPoisonedHTTP2SessionError(err: unknown): boolean {
  if (!(err instanceof Error) || !(err.cause instanceof Error)) {
    return false
  }
  const cause = err.cause as Error & { code?: unknown }
  return (
    cause.code === 'ERR_HTTP2_STREAM_ERROR' &&
    POISONED_HTTP2_SESSION_RST.test(cause.message)
  )
}

const UNDICI_MIN_NODE = '22.19.0'

export async function loadUndici(
  nodeVersion = globalThis.process?.versions?.node
): Promise<UndiciModule | undefined> {
  if (!nodeVersion || compareVersions(nodeVersion, UNDICI_MIN_NODE) < 0) {
    return undefined
  }

  try {
    return await dynamicImport<UndiciModule>('undici')
  } catch {
    // Fall back to the global fetch when undici cannot load (e.g. bundled apps).
    return undefined
  }
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
 * Build a fetch bound to a bounded undici dispatcher (HTTP/2 enabled unless
 * `httpVersion` is `'1.1'`, `connections` origin connections, optional proxy
 * tunnel). A dispatcher whose HTTP/2 session Node reports as out of memory is
 * retired and replaced, so one poisoned session does not fail every later
 * request. Falls back to the global fetch when undici cannot be loaded.
 */
export async function buildDispatchedFetch(options: {
  connections: number
  proxy?: string
  httpVersion?: HttpVersion
  loadUndici?: () => Promise<UndiciModule | undefined>
}): Promise<typeof fetch> {
  const undici = await (options.loadUndici ?? loadUndici)()

  if (!undici) {
    return lateBoundGlobalFetch()
  }

  const { Agent, ProxyAgent, fetch: undiciFetch } = undici
  const agentOptions: UndiciAgentOptions = {
    allowH2: (options.httpVersion ?? DEFAULT_HTTP_VERSION) === '2',
    connections: options.connections,
  }
  const createDispatcher = (): UndiciDispatcher =>
    options.proxy
      ? new ProxyAgent({
          uri: options.proxy,
          ...agentOptions,
          proxyTunnel: true,
        })
      : new Agent(agentOptions)
  const fetchWithDispatcher = undiciFetch as unknown as (
    input: RequestInfo | URL,
    init?: UndiciRequestInit
  ) => Promise<Response>

  let dispatcher = createDispatcher()

  return (async (input, init) => {
    const request = toUndiciRequestInput(input, init)
    const used = dispatcher

    try {
      return await fetchWithDispatcher(request.input, {
        ...request.init,
        dispatcher: used,
      })
    } catch (err) {
      // Only the first failure of a dispatcher replaces it; its other in-flight
      // requests fail the same way and must not retire the replacement.
      if (used === dispatcher && isPoisonedHTTP2SessionError(err)) {
        dispatcher = createDispatcher()
        // Graceful: requests still running on the old sessions finish first.
        void used.close().catch(() => {})
      }
      throw err
    }
  }) as typeof fetch
}

function toUndiciRequestInput(
  input: RequestInfo | URL,
  init?: RequestInit
): { input: RequestInfo | URL; init?: RequestInit & { duplex?: 'half' } } {
  // Every Request has to be taken apart here, including one the current global
  // class disowns: undici brand-checks against its own `Request`, so anything
  // it didn't mint itself — even a native one — is coerced to a URL string and
  // fails with `Failed to parse URL from [object Request]`.
  if (!isRequestLike(input)) {
    return { input, init }
  }

  const requestInit: RequestInit & { duplex?: 'half' } = {
    // A Request from another implementation exposes that implementation's
    // stream as its body, which undici would stringify just like the Request
    // itself. Native bodies pass through untouched.
    body: isReadableStreamLike(input.body)
      ? toDispatchableStream(input.body)
      : input.body,
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
