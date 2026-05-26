import { Logger } from './logs'
import { getEnvVar, version } from './api/metadata'

export const REQUEST_TIMEOUT_MS = 60_000 // 60 seconds
export const DEFAULT_SANDBOX_TIMEOUT_MS = 300_000 // 300 seconds
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
   * E2B access token to use for authentication.
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
   * @default E2B_SANDBOX_URL // environment variable or `https://${port}-${sandboxID}.${domain}`
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
   */
  headers?: Record<string, string>

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
  readonly accessToken?: string

  readonly headers?: Record<string, string>

  constructor(opts?: ConnectionOpts) {
    this.apiKey = opts?.apiKey || ConnectionConfig.apiKey
    this.debug = opts?.debug || ConnectionConfig.debug
    this.domain = opts?.domain || ConnectionConfig.domain
    this.accessToken = opts?.accessToken || ConnectionConfig.accessToken
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
    this.logger = opts?.logger
    this.headers = opts?.headers || {}
    this.headers['User-Agent'] = `e2b-js-sdk/${version}`

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

    return `${this.debug ? 'http' : 'https'}://${this.getHost(sandboxId, opts.envdPort, opts.sandboxDomain)}`
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
