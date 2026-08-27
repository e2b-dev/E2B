import { Logger } from './logs'
import { getEnvVar, version } from './api/metadata'
import { runtime } from './utils'

// Remove once all deployments support sandbox subdomains
const supportedDomains = ['e2b.app', 'e2b.dev', 'e2b.pro', 'e2b-staging.dev']

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
   * Whether to validate the format of the E2B API key on the client side.
   *
   * @deprecated The API key format is no longer validated on the client side;
   * this option has no effect.
   */
  validateApiKey?: boolean
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
   * An optional `AbortSignal` that can be used to cancel the in-flight request.
   * When the signal is aborted, the underlying `fetch` is aborted and the
   * returned promise rejects with an `AbortError`.
   */
  signal?: AbortSignal
}

/**
 * Options accepted by `ConnectionConfig`.
 *
 * @deprecated Use `ConnectionOpts` instead.
 */
export type ConnectionConfigOpts = ConnectionOpts

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

  const onUserAbort = () => abortWithReason(controller, userSignal?.reason)
  if (userSignal) {
    if (userSignal.aborted) {
      abortWithReason(controller, userSignal.reason)
    } else {
      userSignal.addEventListener('abort', onUserAbort, { once: true })
    }
  }

  let reqTimeout: ReturnType<typeof setTimeout> | undefined = requestTimeoutMs
    ? setTimeout(
        () =>
          abortWithReason(
            controller,
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
 * Create a resettable idle-timeout that aborts `controller` when no progress is
 * made within `idleTimeoutMs`. `arm` (re)starts the timer; call it on each
 * chunk. `clear` stops it. `0`/`undefined` disables it (both are no-ops).
 *
 * @internal
 */
function createIdleAbort(
  controller: AbortController,
  idleTimeoutMs: number | undefined,
  label: string
): { arm: () => void; clear: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }
  const arm = () => {
    if (!idleTimeoutMs) return
    clear()
    timer = setTimeout(
      () =>
        abortWithReason(
          controller,
          new DOMException(
            `${label} idle for ${idleTimeoutMs}ms`,
            'TimeoutError'
          )
        ),
      idleTimeoutMs
    )
  }
  return { arm, clear }
}

/**
 * Abort with the reason pinned to the controller. Bun (observed on 1.3.14)
 * holds `signal.reason` weakly: a reason that nothing else strongly
 * references — e.g. a `DOMException` constructed inside a timer callback —
 * can be garbage-collected, leaving `signal.reason` undefined by the time a
 * consumer reads it. Pinning the reason to the controller keeps it alive for
 * the signal's lifetime. No-op cost on other runtimes.
 *
 * @internal
 */
function abortWithReason(controller: AbortController, reason: unknown) {
  // A second abort is a spec-level no-op and must not overwrite the pin that
  // keeps the committed (winning) reason alive.
  if (controller.signal.aborted) return
  ;(controller as { __e2bAbortReason?: unknown }).__e2bAbortReason = reason
  controller.abort(reason)
}

/**
 * Wrap a streaming response body so its pooled connection is released when the
 * stream is fully read, cancelled, errors, or stays idle for too long.
 *
 * Clears the handshake timeout from {@link setupRequestController} (so
 * consuming the body isn't killed by it) and replaces it with an idle-read
 * timeout that bounds only the wire: it's armed while waiting on a network
 * read and cleared the moment a chunk arrives, so a slow or paused consumer
 * never trips it (only a server that stops sending mid-stream does). On expiry
 * it aborts `controller`, tearing down the fetch and releasing the connection.
 * Pass `0`/`undefined` to disable. Call once the handshake has succeeded.
 *
 * @internal
 */
export function wrapStreamWithConnectionCleanup(
  body: ReadableStream<Uint8Array> | null,
  {
    clearStartTimeout,
    cleanup,
    controller,
    idleTimeoutMs,
  }: {
    clearStartTimeout: () => void
    cleanup: () => void
    controller: AbortController
    idleTimeoutMs?: number
  }
): ReadableStream<Uint8Array> {
  clearStartTimeout()

  if (!body) {
    cleanup()
    return new Blob([]).stream()
  }

  const reader = body.getReader()
  const idle = createIdleAbort(controller, idleTimeoutMs, 'Stream')

  // Idempotent: safe to call from multiple stream callbacks — cancelling
  // while a pull is in flight settles both paths (the pending read resolves
  // `done` after `reader.cancel()`), which must not release twice.
  let released = false
  const release = () => {
    if (released) {
      return
    }
    released = true
    idle.clear()
    cleanup()
  }

  return new ReadableStream<Uint8Array>({
    async pull(streamController) {
      // Bound only the wire: arm before reading from the network and clear the
      // moment a chunk (or EOF) arrives, so a slow or paused consumer never
      // counts against the idle timeout. A consumer that holds the stream but
      // stops reading is never pulled here, so nothing arms—that case is
      // reclaimed server-side, not by this timer.
      idle.arm()
      try {
        const { done, value } = await reader.read()
        idle.clear()
        if (done) {
          release()
          streamController.close()
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
}

/**
 * Configuration for connecting to the API.
 */
export class ConnectionConfig {
  public static envdPort = 49983

  private static integration?: string

  private static readonly sdkUserAgentPrefix = 'e2b-js-sdk/'

  private static buildUserAgent() {
    const userAgentParts = [`${ConnectionConfig.sdkUserAgentPrefix}${version}`]

    if (ConnectionConfig.integration) {
      userAgentParts.push(ConnectionConfig.integration)
    }

    return userAgentParts.join(' ')
  }

  /**
   * Set the `User-Agent` on `headers`: an explicitly provided value always
   * wins; otherwise the SDK-built one, tagged with the current integration.
   *
   * An SDK-built value carried over from an earlier config (configs are
   * rebuilt via `new ConnectionConfig({ ...config })`) is recognized by its
   * prefix and rebuilt, so it stays in sync with the current integration.
   */
  private static applyUserAgent(headers: Record<string, string>) {
    const userAgent = headers['User-Agent']

    if (
      userAgent !== undefined &&
      !userAgent.startsWith(ConnectionConfig.sdkUserAgentPrefix)
    ) {
      return
    }

    headers['User-Agent'] = ConnectionConfig.buildUserAgent()
  }

  /**
   * Identify traffic from an integration wrapping the E2B SDK by appending
   * `integration` (e.g. `'e2b-code-interpreter/0.1.0'`) to the `User-Agent`
   * header of every request.
   *
   * Call once at startup, before any `ConnectionConfig` is constructed —
   * configs read the value at construction time. Pass `undefined` to clear.
   *
   * @internal
   * @hidden
   * @hide
   */
  static setIntegration(integration: string | undefined) {
    ConnectionConfig.integration = integration
  }

  readonly debug: boolean
  readonly domain: string
  readonly apiUrl: string
  readonly sandboxUrl?: string
  readonly logger?: Logger

  readonly requestTimeoutMs: number

  readonly apiKey?: string
  /**
   * @deprecated The API key format is no longer validated on the client side;
   * this option has no effect.
   */
  readonly validateApiKey?: boolean

  readonly headers?: Record<string, string>

  readonly proxy?: string

  constructor(opts?: ConnectionOpts) {
    this.apiKey = opts?.apiKey || ConnectionConfig.apiKey
    this.validateApiKey = opts?.validateApiKey
    this.debug = opts?.debug ?? ConnectionConfig.debug
    this.domain = opts?.domain || ConnectionConfig.domain
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
    this.logger = opts?.logger
    this.headers = { ...(opts?.headers ?? {}), ...(opts?.apiHeaders ?? {}) }
    ConnectionConfig.applyUserAgent(this.headers)
    this.proxy = opts?.proxy

    this.apiUrl =
      opts?.apiUrl ||
      ConnectionConfig.apiUrl ||
      (this.debug ? 'http://localhost:3000' : `https://api.${this.domain}`)

    this.sandboxUrl = opts?.sandboxUrl || ConnectionConfig.sandboxUrl
  }

  /**
   * Merge connection options bound to a class (e.g. by an `E2B` client) with
   * the per-call options. Per-call options win, then the bound options, then
   * the environment variables resolved by the `ConnectionConfig` constructor.
   *
   * Explicitly `undefined` per-call values are dropped so they fall back to the
   * bound options instead of clearing them.
   *
   * @internal
   * @hidden
   * @hide
   */
  static mergeOpts<T extends ConnectionOpts>(
    boundOpts: ConnectionOpts | undefined,
    opts?: T
  ): T | undefined {
    if (!boundOpts) {
      return opts
    }

    const merged: Record<string, unknown> = { ...boundOpts }
    for (const [key, value] of Object.entries(opts ?? {})) {
      if (value !== undefined) {
        // `defineProperty` so a `__proto__` key (e.g. from parsed JSON) becomes
        // a plain own property instead of changing the prototype.
        Object.defineProperty(merged, key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        })
      }
    }

    return merged as T
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
 * Base class for the resource classes (`Sandbox`, `Volume`, `Template`,
 * `Secret`) whose static methods build a `ConnectionConfig` from per-call
 * options. An {@link E2B} client exposes subclasses of these with its own
 * options bound, and every static method resolves them through
 * {@link ClientFactory.resolveOpts}.
 *
 * @internal
 * @hidden
 * @hide
 */
export class ClientFactory {
  /**
   * Connection options bound to this class by an {@link E2B} client.
   *
   * Empty on the base classes, so the env-configured default path is unchanged.
   *
   * @internal
   * @hidden
   * @hide
   */
  protected static readonly boundOpts?: Omit<ConnectionOpts, 'signal'>

  /**
   * Return a subclass of this class with `opts` bound to it, used as the
   * defaults for every call instead of the environment variables.
   * Per-call options still take precedence over the bound options.
   *
   * @internal
   * @hidden
   * @hide
   */
  // The static sides of the subclasses are not assignable to
  // `typeof ClientFactory` (their constructors differ), and TS has no
  // polymorphic `this` for statics, so the constraint is structural and the
  // subclass expression cannot be typed as `T` without the cast.
  static withOpts<T extends { prototype: ClientFactory }>(
    this: T,
    opts?: Omit<ConnectionOpts, 'signal'>
  ): T {
    // Options are copied so later mutations of the caller's object cannot
    // change the bound configuration. `signal` is dropped rather than only
    // typed away, since it cancels a single request and a caller passing a
    // wider-typed object (or plain JS) would otherwise bind it to every call.
    const boundOpts: Omit<ConnectionOpts, 'signal'> = { ...(opts ?? {}) }
    delete (boundOpts as ConnectionOpts).signal

    return class extends (this as unknown as typeof ClientFactory) {
      protected static override readonly boundOpts = boundOpts
    } as unknown as T
  }

  /**
   * Merge the connection options bound to this class with the per-call options,
   * with the per-call options taking precedence.
   *
   * @internal
   * @hidden
   * @hide
   */
  protected static resolveOpts<T extends ConnectionOpts>(
    opts?: T
  ): T | undefined {
    return ConnectionConfig.mergeOpts(this.boundOpts, opts)
  }
}

/**
 * User used for the operation in the sandbox.
 */

export const defaultUsername: Username = 'user'
export type Username = string
