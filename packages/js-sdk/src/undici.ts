import { compareVersions } from 'compare-versions'

import { limitConcurrency } from './api/inflight'
import { isReadableStreamLike, isRequestLike } from './is'
import { dynamicImport, toDispatchableStream } from './utils'

type UndiciRequestInit = RequestInit & {
  dispatcher?: unknown
  duplex?: 'half'
}

/** TLS options undici hands to `tls.connect`. */
type TlsOptions = { ca: string[] }

export type UndiciModule = {
  Agent: new (options: {
    allowH2: boolean
    connections?: number
    connect?: TlsOptions
  }) => unknown
  ProxyAgent: new (options: {
    uri: string
    allowH2: boolean
    connections?: number
    proxyTunnel: true
    // A ProxyAgent builds its own `connect`, so the TLS options for the
    // tunneled request to the origin (and for an HTTPS proxy) go here.
    requestTls?: TlsOptions
    proxyTls?: TlsOptions
  }) => unknown
  fetch: unknown
}

/**
 * The connection options that shape a dispatcher: the proxy requests are sent
 * through and the TLS trust servers are validated against. Fetchers are cached
 * per distinct combination.
 */
export type FetchTransportOpts = {
  proxy?: string
  caBundle?: string
}

/**
 * The cache key of a fetcher built for these options. Neither a path nor a URL
 * can contain a newline, so the parts can't run together.
 */
export function transportCacheKey(options: FetchTransportOpts = {}): string {
  return `${options.proxy ?? ''}\n${options.caBundle ?? ''}`
}

const PEM_CERTIFICATE_MARKER = '-----BEGIN CERTIFICATE-----'

/**
 * The certificates a dispatcher trusts: the PEM bundle at `caBundle` on top of
 * the default roots, so a private CA is trusted in addition to the public ones
 * rather than instead of them.
 *
 * Node only — `node:fs` and `node:tls` are imported at runtime so other
 * runtimes never resolve them.
 */
async function loadCaCertificates(caBundle: string): Promise<string[]> {
  const [fs, tls] = await Promise.all([
    dynamicImport<typeof import('node:fs/promises')>('node:fs/promises'),
    dynamicImport<typeof import('node:tls')>('node:tls'),
  ])

  let pem: string
  try {
    pem = await fs.readFile(caBundle, 'utf8')
  } catch (err) {
    throw new Error(
      `Could not read the CA bundle at '${caBundle}': ${err}. \`caBundle\` (or the E2B_CA_BUNDLE environment variable) must be the path of a PEM file holding the CA certificates to trust.`
    )
  }

  if (!pem.includes(PEM_CERTIFICATE_MARKER)) {
    throw new Error(
      `The CA bundle at '${caBundle}' holds no PEM certificate: expected a file containing "${PEM_CERTIFICATE_MARKER}". Convert a DER certificate with \`openssl x509 -inform der -in ca.der -out ca.pem\`.`
    )
  }

  return [...tls.rootCertificates, pem]
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
 * Reject a CA bundle in a runtime that cannot apply it. Only Node lets the SDK
 * configure TLS trust per connection; failing here beats connecting with the
 * default trust the option asked to extend and reporting an unrelated
 * certificate error per request.
 */
export function assertCaBundleSupported(
  currentRuntime: string,
  caBundle: string | undefined
): void {
  if (caBundle && currentRuntime !== 'node') {
    throw new Error(
      `\`caBundle\` is only supported on Node, but the current runtime is ${currentRuntime}. Trust the CA through the runtime instead (e.g. the system certificate store).`
    )
  }
}

/**
 * Create a fetch for the given runtime. Outside Node it late-binds the global
 * fetch. On Node it lazily runs `build` on the first request and caches the
 * built fetcher; a failed build is not cached, so the next request retries
 * instead of replaying the same stale rejection forever.
 */
export function createRuntimeFetch(
  currentRuntime: string,
  build: () => Promise<typeof fetch>,
  options: FetchTransportOpts = {}
): typeof fetch {
  if (currentRuntime !== 'node') {
    assertCaBundleSupported(currentRuntime, options.caBundle)

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
 * `allowH2` says otherwise, `connections` origin connections, optional proxy
 * tunnel and CA bundle), capped at `inflightLimit` in-flight requests (`0`
 * disables the cap). Falls back to the global fetch — still capped — when
 * undici cannot be loaded.
 */
export async function buildDispatchedFetch(
  options: FetchTransportOpts & {
    connections: number
    inflightLimit: number
    allowH2?: boolean
    loadUndici?: () => Promise<UndiciModule | undefined>
  }
): Promise<typeof fetch> {
  const undici = await (options.loadUndici ?? loadUndici)()

  if (!undici) {
    if (options.caBundle) {
      // The global fetch takes no dispatcher, so the configured trust would
      // be dropped rather than applied.
      throw new Error(
        '`caBundle` needs the `undici` package, which could not be loaded. Install `undici` (or bundle it) to trust a private CA.'
      )
    }

    return limitConcurrency(lateBoundGlobalFetch(), options.inflightLimit)
  }

  const { Agent, ProxyAgent, fetch: undiciFetch } = undici
  const tls: TlsOptions | undefined = options.caBundle
    ? { ca: await loadCaCertificates(options.caBundle) }
    : undefined
  const allowH2 = options.allowH2 ?? true
  const dispatcher = options.proxy
    ? new ProxyAgent({
        uri: options.proxy,
        allowH2,
        connections: options.connections,
        proxyTunnel: true,
        requestTls: tls,
        proxyTls: tls,
      })
    : new Agent({
        allowH2,
        connections: options.connections,
        connect: tls,
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
