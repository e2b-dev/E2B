import { Logger } from './logs'
import { getEnvVar, version } from './api/metadata'
import { runtime } from './utils'

// Remove once all deployments support sandbox subdomains
const supportedDomains = ['e2b.app', 'e2b.dev', 'e2b.pro', 'e2b-staging.dev']

export const REQUEST_TIMEOUT_MS = 60_000 // 60 seconds
export const DEFAULT_SANDBOX_TIMEOUT_MS = 300_000 // 300 seconds
// Default timeout for streaming file transfers (uploads/downloads). A streamed
// body can take far longer than a regular request, so it must not inherit the
// short `REQUEST_TIMEOUT_MS`.
export const FILE_TIMEOUT_MS = 3_600_000 // 1 hour
export const KEEPALIVE_PING_INTERVAL_SEC = 50 // 50 seconds

export const KEEPALIVE_PING_HEADER = 'Keepalive-Ping-Interval'

/**
 * Connection options for requests to the API.
 */
export interface ConnectionOpts {
  /**
   * E2B API key to use for authentication.
   *
   * @default E2B_API_KEY // environment variable
   */
  apiKey?: string
  /**
   * Whether to validate the format of the E2B API key on the client side.
   * Disable this when your deployment issues API keys that don't match the
   * default `e2b_` format.
   *
   * @default E2B_VALIDATE_API_KEY // environment variable or `true`
   */
  validateApiKey?: boolean
  /**
   * E2B access token to use for authentication.
   *
   * @deprecated Pass the token through `apiHeaders` instead, e.g.
   * `apiHeaders: { Authorization: \`Bearer ${token}\` }`.
   *
   * @default E2B_ACCESS_TOKEN // environment variable
   */
  accessToken?: string
  /**
   * Domain to use for the API.
   *
   * @default E2B_DOMAIN // environment variable or `e2b.app`
   */
  domain?: string
  /**
   * API Url to use for the API.
   * @internal
   * @default E2B_API_URL // environment variable or `https://api.${domain}`
   */
  apiUrl?: string
  /**
   * Sandbox Url to use for the API.
   * @internal
   * @default E2B_SANDBOX_URL // environment variable, `https://sandbox.${domain}`
   */
  sandboxUrl?: string
  /**
   * If true the SDK starts in the debug mode and connects to the local envd API server.
   * @internal
   * @default E2B_DEBUG // environment variable or `false`
   */
  debug?: boolean
  /**
   * Timeout for requests to the API in **milliseconds**.
   *
   * @default 60_000 // 60 seconds
   */
  requestTimeoutMs?: number
  /**
   * Logger to use for logging messages. It can accept any object that implements `Logger` interface—for example, {@link console}.
   */
  logger?: Logger

  /**
   * Additional headers to send with the request.
   *
   * @deprecated Use `apiHeaders` instead.
   */
  headers?: Record<string, string>

  /**
   * Proxy URL to use for requests. In case of a sandbox it applies to all
   * requests made to the returned sandbox.
   *
   * @example 'http://user:pass@127.0.0.1:8080'
   */
  proxy?: string

  /**
   * Additional headers to send with E2B API requests.
   */
  apiHeaders?: Record<string, string>

  /**
   * Integration wrapping the E2B SDK, appended to the `User-Agent`.
   *
   * @example 'e2b-code-interpreter/0.1.0'
   */
  integration?: string

  /**
   * An optional `AbortSignal` that can be used to cancel the in-flight request.
   * When the signal is aborted, the underlying `fetch` is aborted and the
   * returned promise rejects with an `AbortError`.
   */
  signal?: AbortSignal
}

/**
 * Build an `AbortSignal` that combines an optional request-timeout signal
 * (via `AbortSignal.timeout`) with an optional user-provided signal.
 *
 * Returns `undefined` when neither input would produce a signal.
 *
 * @internal
 */
export function buildRequestSignal(
  requestTimeoutMs: number | undefined,
  userSignal: AbortSignal | undefined
): AbortSignal | undefined {
  // `0` (and `undefined`) disable the request timeout.
  const timeoutSignal = requestTimeoutMs
    ? AbortSignal.timeout(requestTimeoutMs)
    : undefined

  if (timeoutSignal && userSignal) {
    return AbortSignal.any([timeoutSignal, userSignal])
  }

  return timeoutSignal ?? userSignal
}

/**
 * Set up an internal `AbortController` for a streaming request.
 *
 * Until `clearStartTimeout` is called, the controller aborts when either
 *  - the optional user signal aborts, or
 *  - the optional request timeout elapses (used to bound the initial
 *    handshake; long-lived streams should call `clearStartTimeout` once
 *    the handshake succeeds).
 *
 * The user-signal listener stays attached for the full stream lifetime
 * so the caller can cancel a long-running stream by aborting the signal.
 *
 * `cleanup` is idempotent and detaches the listener, clears the handshake
 * timer (if still pending), and aborts the controller. Call it when the
 * stream finishes or when startup fails.
 *
 * @internal
 */
export function setupRequestController(
  requestTimeoutMs: number | undefined,
  userSignal: AbortSignal | undefined
): {
  controller: AbortController
  clearStartTimeout: () => void
  cleanup: () => void
} {
  const controller = new AbortController()

  const onUserAbort = () => controller.abort(userSignal?.reason)
  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort(userSignal.reason)
    } else {
      userSignal.addEventListener('abort', onUserAbort, { once: true })
    }
  }

  let reqTimeout: ReturnType<typeof setTimeout> | undefined = requestTimeoutMs
    ? setTimeout(
        () =>
          controller.abort(
            new DOMException(
              `Request handshake timed out after ${requestTimeoutMs}ms`,
              'TimeoutError'
            )
          ),
        requestTimeoutMs
      )
    : undefined

  const clearStartTimeout = () => {
    if (reqTimeout) {
      clearTimeout(reqTimeout)
      reqTimeout = undefined
    }
  }

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    userSignal?.removeEventListener('abort', onUserAbort)
    clearStartTimeout()
    controller.abort()
  }

  return { controller, clearStartTimeout, cleanup }
}

// GC safety net for streamed reads: if the consumer drops a streamed response
// body without reading it to completion or cancelling it, the registered
// callback releases the underlying connection when the stream is garbage
// collected. This mirrors the Python SDK's `weakref.finalize` on
// `FileStreamReader`. The held value is a release callback, which must not
// reference the stream itself or it would never be collected.
const streamReadFinalizers = new FinalizationRegistry<() => void>((release) =>
  release()
)

/**
 * Wrap a streaming response body so its pooled connection is released when the
 * stream is fully read, cancelled, errors, or (as a GC safety net) abandoned.
 *
 * The request timeout configured via {@link setupRequestController} bounds only
 * the initial handshake; this clears that timeout so consuming the body is not
 * killed by it. Call once the handshake has succeeded (after error handling).
 *
 * @internal
 */
export function wrapStreamWithConnectionCleanup(
  body: ReadableStream<Uint8Array> | null,
  {
    clearStartTimeout,
    cleanup,
  }: { clearStartTimeout: () => void; cleanup: () => void }
): ReadableStream<Uint8Array> {
  clearStartTimeout()

  if (!body) {
    cleanup()
    return new Blob([]).stream()
  }

  const reader = body.getReader()
  const unregisterToken = {}
  // Detach the GC finalizer and release the connection. Idempotent via
  // `cleanup`, so it's safe to call from multiple stream callbacks. The body
  // reader is cancelled separately by the callbacks that have already drained
  // or are cancelling it.
  const release = () => {
    streamReadFinalizers.unregister(unregisterToken)
    cleanup()
  }
  // GC safety net: when the wrapped stream is abandoned without being read to
  // completion or cancelled, cancel the underlying body reader so the pooled
  // connection is released (matching the cancel/error paths) and then run
  // cleanup. Must reference `reader`/`cleanup` only — never the wrapped
  // `stream`, or it would never be garbage collected.
  const releaseOnAbandon = () => {
    reader.cancel().catch(() => {})
    cleanup()
  }

  const stream = new ReadableStream<Uint8Array>({
    async pull(streamController) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          streamController.close()
          release()
        } else {
          streamController.enqueue(value)
        }
      } catch (err) {
        release()
        streamController.error(err)
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason)
      } finally {
        release()
      }
    },
  })

  // Release the connection if the consumer abandons the stream without
  // reading it to completion or cancelling it.
  streamReadFinalizers.register(stream, releaseOnAbandon, unregisterToken)

  return stream
}

function buildUserAgent(integration?: string) {
  const userAgentParts = [`e2b-js-sdk/${version}`]

  if (integration) {
    userAgentParts.push(integration)
  }

  return userAgentParts.join(' ')
}

/**
 * Configuration for connecting to the API.
 */
export class ConnectionConfig {
  public static envdPort = 49983

  readonly debug: boolean
  readonly domain: string
  readonly apiUrl: string
  readonly sandboxUrl?: string
  readonly logger?: Logger

  readonly requestTimeoutMs: number

  readonly apiKey?: string
  readonly validateApiKey: boolean
  /**
   * @deprecated Pass the token through `apiHeaders` instead.
   */
  readonly accessToken?: string

  readonly integration?: string

  readonly headers?: Record<string, string>

  readonly proxy?: string

  constructor(opts?: ConnectionOpts) {
    this.apiKey = opts?.apiKey || ConnectionConfig.apiKey
    this.validateApiKey =
      opts?.validateApiKey ?? ConnectionConfig.validateApiKey
    this.debug = opts?.debug ?? ConnectionConfig.debug
    this.domain = opts?.domain || ConnectionConfig.domain
    this.accessToken = opts?.accessToken || ConnectionConfig.accessToken
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
    this.logger = opts?.logger
    this.integration = opts?.integration
    this.headers = { ...(opts?.headers ?? {}), ...(opts?.apiHeaders ?? {}) }
    this.headers['User-Agent'] = buildUserAgent(this.integration)
    this.proxy = opts?.proxy

    this.apiUrl =
      opts?.apiUrl ||
      ConnectionConfig.apiUrl ||
      (this.debug ? 'http://localhost:3000' : `https://api.${this.domain}`)

    this.sandboxUrl = opts?.sandboxUrl || ConnectionConfig.sandboxUrl
  }

  private static get domain() {
    return getEnvVar('E2B_DOMAIN') || 'e2b.app'
  }

  private static get apiUrl() {
    return getEnvVar('E2B_API_URL')
  }

  private static get sandboxUrl() {
    return getEnvVar('E2B_SANDBOX_URL')
  }

  private static get debug() {
    return (getEnvVar('E2B_DEBUG') || 'false').toLowerCase() === 'true'
  }

  private static get apiKey() {
    return getEnvVar('E2B_API_KEY')
  }

  private static get validateApiKey() {
    return (
      (getEnvVar('E2B_VALIDATE_API_KEY') || 'true').toLowerCase() !== 'false'
    )
  }

  private static get accessToken() {
    return getEnvVar('E2B_ACCESS_TOKEN')
  }

  getSignal(requestTimeoutMs?: number, signal?: AbortSignal) {
    return buildRequestSignal(requestTimeoutMs ?? this.requestTimeoutMs, signal)
  }

  getSandboxUrl(
    sandboxId: string,
    opts: { sandboxDomain: string; envdPort: number }
  ) {
    if (this.sandboxUrl) {
      return this.sandboxUrl
    }

    if (this.debug) {
      return `http://${this.getHost(sandboxId, opts.envdPort, opts.sandboxDomain)}`
    }

    const sandboxDomain = opts.sandboxDomain ?? this.domain
    // The stable sandbox host is only guaranteed for E2B prod; the various other hosted domains may not serve sandbox.<domain> yet and will follow up once those are updated.
    // Issue with cors from browser so holding off on using in browser as well.
    if (runtime !== 'browser' && supportedDomains.includes(sandboxDomain)) {
      return `https://sandbox.${sandboxDomain}`
    }

    return `https://${this.getHost(sandboxId, opts.envdPort, sandboxDomain)}`
  }

  getSandboxDirectUrl(
    sandboxId: string,
    opts: { sandboxDomain: string; envdPort: number }
  ) {
    if (this.sandboxUrl) {
      return this.sandboxUrl
    }

    if (this.debug) {
      return `http://${this.getHost(sandboxId, opts.envdPort, opts.sandboxDomain)}`
    }

    return `https://${this.getHost(sandboxId, opts.envdPort, opts.sandboxDomain)}`
  }

  getHost(sandboxId: string, port: number, sandboxDomain: string) {
    if (this.debug) {
      return `localhost:${port}`
    }

    return `${port}-${sandboxId}.${sandboxDomain ?? this.domain}`
  }
}

/**
 * User used for the operation in the sandbox.
 */

export const defaultUsername: Username = 'user'
export type Username = string
