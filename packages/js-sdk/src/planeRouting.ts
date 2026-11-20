import { isSupportedDomain } from './connectionConfig'
import type { ConnectionConfig } from './connectionConfig'
import { isRetryableFetchError } from './retry'
import { runtime } from './utils'

/**
 * Response header E2B's global API proxy sets on every request it forwards:
 * the API host of the control plane that answered, e.g. `api.e2b-foxtrot.dev`.
 */
export const ALT_USED_HEADER = 'X-E2B-Alt-Used'

/**
 * How long a learned control plane is used before requests go through the
 * global proxy again, so a project that moved to another control plane is
 * followed even while its previous one still answers.
 */
export const PLANE_TTL_MS = 5 * 60_000

type LearnedPlane = { domain: string; learnedAt: number }

// Keyed by `planeKey`: a control plane belongs to an API key's team, and one
// process can use several keys against several domains.
const planes = new Map<string, LearnedPlane>()

/**
 * The key a config's learned control plane is stored under, or `undefined`
 * when the config must not be routed: in the browser, in debug mode, with an
 * overridden API or sandbox URL, without an API key, or on a domain the SDK
 * does not support.
 *
 * @internal
 */
export function planeKey(
  config: Pick<
    ConnectionConfig,
    'apiKey' | 'apiUrl' | 'debug' | 'domain' | 'sandboxUrl'
  >
): string | undefined {
  if (
    runtime === 'browser' ||
    config.debug ||
    !config.apiKey ||
    config.sandboxUrl ||
    !isSupportedDomain(config.domain) ||
    config.apiUrl !== `https://api.${config.domain}`
  ) {
    return undefined
  }

  return `${config.domain}\n${config.apiKey}`
}

/**
 * Learns the control plane from a response, when it came from a supported
 * API host and names one.
 *
 * @internal
 */
export function learnPlane(
  key: string,
  requestURL: string,
  response: Response,
  now = Date.now()
) {
  if (!supportedApiDomain(new URL(requestURL).hostname)) {
    return
  }

  const domain = supportedApiDomain(
    response.headers.get(ALT_USED_HEADER)?.trim().toLowerCase()
  )
  if (domain) {
    planes.set(key, { domain, learnedAt: now })
  }
}

/**
 * The control plane learned for `key`, unless it has expired.
 *
 * @internal
 */
export function currentPlane(
  key: string,
  now = Date.now()
): string | undefined {
  const plane = planes.get(key)
  if (!plane || now - plane.learnedAt >= PLANE_TTL_MS) {
    return undefined
  }

  return plane.domain
}

/**
 * Forgets `domain` for `key`, unless a newer response has replaced it since.
 *
 * @internal
 */
export function forgetPlane(key: string, domain: string) {
  if (planes.get(key)?.domain === domain) {
    planes.delete(key)
  }
}

/** @internal */
export function resetPlanes() {
  planes.clear()
}

// `api.<domain>` with `<domain>` supported, as `<domain>`.
function supportedApiDomain(host: string | undefined): string | undefined {
  if (!host?.startsWith('api.')) {
    return undefined
  }

  const domain = host.slice('api.'.length)
  return isSupportedDomain(domain) ? domain : undefined
}

/**
 * `url` with its host moved from `from` to `to`: `api.<from>` to `api.<to>`,
 * `sandbox.<from>` to `sandbox.<to>`, `<port>-<id>.<from>` to
 * `<port>-<id>.<to>`. `undefined` when the host is not under `from`.
 */
function moveHost(url: string, from: string, to: string): URL | undefined {
  const moved = new URL(url)
  const suffix = `.${from}`
  if (!moved.hostname.endsWith(suffix)) {
    return undefined
  }

  const label = moved.hostname.slice(0, -suffix.length)
  if (!label || label.includes('.')) {
    return undefined
  }

  moved.hostname = `${label}.${to}`
  return moved
}

type FetchArgs = { input: RequestInfo | URL; init?: RequestInit }

function inputURL(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : input.toString()
}

function isReplayable({ input, init }: FetchArgs): boolean {
  if (input instanceof Request) {
    return input.body === null
  }

  const body = init?.body
  return (
    body === undefined ||
    body === null ||
    typeof body === 'string' ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  )
}

function withURL({ input, init }: FetchArgs, url: URL): FetchArgs {
  if (!(input instanceof Request)) {
    return { input: url, init }
  }

  const routed: RequestInit & { duplex?: 'half' } = {
    method: input.method,
    headers: input.headers,
    signal: input.signal,
    redirect: input.redirect,
  }
  if (input.body !== null) {
    routed.body = input.body
    routed.duplex = 'half'
  }

  return { input: new Request(url, routed), init }
}

function copy({ input, init }: FetchArgs): FetchArgs {
  return { input: input instanceof Request ? input.clone() : input, init }
}

/**
 * Sends API requests to the control plane the global API proxy last named in
 * {@link ALT_USED_HEADER}, and learns it from every response that names one.
 *
 * A request to a learned plane that is refused with 401 or cannot connect to
 * it is sent again through the configured API host, which names the plane that
 * answers now: an API key is only accepted by its own plane.
 *
 * @internal
 */
export function withApiPlaneRouting(
  fetchImpl: typeof fetch,
  config: ConnectionConfig
): typeof fetch {
  const key = planeKey(config)
  if (!key) {
    return fetchImpl
  }

  const send = async (request: Request) => {
    const response = await fetchImpl(request)
    learnPlane(key, request.url, response)
    return response
  }

  return (async (input, init) => {
    const request =
      input instanceof Request && init === undefined
        ? input
        : new Request(input, init)
    const plane = currentPlane(key)
    const url = plane && moveHost(request.url, config.domain, plane)
    if (!plane || !url) {
      return send(request)
    }

    // API request bodies are serialized JSON, so buffering them to send the
    // request a second time costs little.
    const body =
      request.body === null ? undefined : await request.clone().arrayBuffer()
    const to = (target: string | URL) =>
      new Request(target, {
        method: request.method,
        headers: request.headers,
        body,
        signal: request.signal,
        redirect: request.redirect,
      })

    let response: Response
    try {
      response = await send(to(url))
    } catch (error) {
      // Only a connection that was never made is safe to send again.
      if (!isRetryableFetchError(error)) throw error
      forgetPlane(key, plane)
      return send(to(request.url))
    }

    if (response.status !== 401) {
      return response
    }

    forgetPlane(key, plane)
    void response.body?.cancel().catch(() => {})
    return send(to(request.url))
  }) as typeof fetch
}

/**
 * Sends one sandbox's envd requests to the control plane learned for its API
 * key, when the API did not name a domain for the sandbox itself.
 *
 * A replayable request the plane answers with 502 or cannot connect for is
 * sent again through the configured sandbox host. When that one succeeds the
 * sandbox stays on the configured host for {@link PLANE_TTL_MS}: it is no
 * longer on the learned plane.
 *
 * @internal
 */
export class EnvdPlaneRouting {
  private configuredUntil = 0

  constructor(
    private readonly key: string | undefined,
    private readonly domain: string
  ) {}

  /**
   * Routes `fetchImpl` through this sandbox's control plane.
   */
  wrap(fetchImpl: typeof fetch): typeof fetch {
    if (!this.key) {
      return fetchImpl
    }

    return ((input, init) =>
      this.fetch(fetchImpl, { input, init })) as typeof fetch
  }

  private async fetch(fetchImpl: typeof fetch, args: FetchArgs) {
    const now = Date.now()
    const plane =
      this.key && now >= this.configuredUntil
        ? currentPlane(this.key, now)
        : undefined
    const url = plane && moveHost(inputURL(args.input), this.domain, plane)
    if (!plane || !url) {
      return fetchImpl(args.input, args.init)
    }

    const routed = withURL(args, url)
    if (!isReplayable(args)) {
      return fetchImpl(routed.input, routed.init)
    }

    const fallback = copy(args)
    let response: Response
    try {
      response = await fetchImpl(routed.input, routed.init)
    } catch (error) {
      if (!isRetryableFetchError(error)) throw error
      return this.fallback(fetchImpl, fallback)
    }

    if (response.status !== 502) {
      return response
    }

    void response.body?.cancel().catch(() => {})
    return this.fallback(fetchImpl, fallback)
  }

  private async fallback(fetchImpl: typeof fetch, args: FetchArgs) {
    const response = await fetchImpl(args.input, args.init)
    if (response.ok) {
      this.configuredUntil = Date.now() + PLANE_TTL_MS
    }
    return response
  }
}
