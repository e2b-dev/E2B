import { compareVersions } from 'compare-versions'

import { limitConcurrency } from './api/inflight'
import { isReadableStreamLike, isRequestLike } from './is'
import { dynamicImport, toDispatchableStream } from './utils'
import { backoffMs, isConnectionError } from './retry'
import { DEFAULT_HTTP_VERSION, type HttpVersion } from './connectionConfig'

type UndiciRequestInit = RequestInit & {
  dispatcher?: unknown
  duplex?: 'half'
}

/**
 * undici connector: establishes the TCP/TLS socket for a new origin connection.
 */
export type UndiciConnector = (
  options: Record<string, unknown>,
  callback: (err: Error | null, socket?: unknown) => void
) => void

export type UndiciModule = {
  Agent: new (options: {
    allowH2: boolean
    connections?: number
    connect?: UndiciConnector
  }) => unknown
  buildConnector?: (options: { allowH2: boolean }) => UndiciConnector
  ProxyAgent: new (options: {
    uri: string
    allowH2: boolean
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

export type ConnectRetryDependencies = {
  sleep?: (delayMs: number) => Promise<void>
  random?: () => number
}

/**
 * Wrap an undici connector so that a socket that cannot be established
 * ({@link isConnectionError}: connection refused, DNS failure, unreachable
 * host, connect timeout) is attempted again up to `retries` times with
 * exponential backoff. Only the TCP/TLS connect is repeated — undici
 * dispatches the request once, after a socket exists — so this is safe for
 * every request, unary or streaming. Matches the Python SDK's
 * `ConnectionRetryTransport`.
 */
export function withConnectRetries(
  connect: UndiciConnector,
  retries: number,
  dependencies: ConnectRetryDependencies = {}
): UndiciConnector {
  if (retries === 0) {
    return connect
  }

  const sleep =
    dependencies.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)))
  const random = dependencies.random ?? Math.random

  return (options, callback) => {
    let attempt = 0

    const attemptConnect = () =>
      connect(options, (err, socket) => {
        if (err && attempt < retries && isConnectionError(err)) {
          sleep(backoffMs(attempt++, random)).then(attemptConnect)
          return
        }

        callback(err, socket)
      })

    attemptConnect()
  }
}

/**
 * Build a fetch bound to a bounded undici dispatcher (HTTP/2 enabled unless
 * `httpVersion` is `'1.1'`, `connections` origin connections, optional proxy
 * tunnel), capped at `inflightLimit` in-flight requests (`0` disables the
 * cap). Falls back to the global fetch — still capped — when undici cannot be
 * loaded.
 *
 * With `connectRetries > 0`, sockets that cannot be established are retried
 * at the connector level ({@link withConnectRetries}). `ProxyAgent` builds its
 * own connectors for the proxy and the tunnel, so proxied traffic is not
 * retried.
 */
export async function buildDispatchedFetch(options: {
  connections: number
  inflightLimit: number
  proxy?: string
  httpVersion?: HttpVersion
  connectRetries?: number
  loadUndici?: () => Promise<UndiciModule | undefined>
}): Promise<typeof fetch> {
  const undici = await (options.loadUndici ?? loadUndici)()

  if (!undici) {
    return limitConcurrency(lateBoundGlobalFetch(), options.inflightLimit)
  }

  const { Agent, ProxyAgent, buildConnector, fetch: undiciFetch } = undici
  const allowH2 = (options.httpVersion ?? DEFAULT_HTTP_VERSION) === '2'
  const connectRetries = options.connectRetries ?? 0
  const connect =
    connectRetries > 0 && buildConnector
      ? withConnectRetries(buildConnector({ allowH2 }), connectRetries)
      : undefined
  const dispatcher = options.proxy
    ? new ProxyAgent({
        uri: options.proxy,
        allowH2,
        connections: options.connections,
        proxyTunnel: true,
      })
    : new Agent({
        allowH2,
        connections: options.connections,
        ...(connect ? { connect } : {}),
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
