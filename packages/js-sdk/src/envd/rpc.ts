import { Code, ConnectError } from '@connectrpc/connect'
import { runtime } from '../utils'

import { compareVersions } from 'compare-versions'
import { defaultUsername } from '../connectionConfig'
import {
  AuthenticationError,
  formatSandboxUnavailableError,
  InvalidArgumentError,
  NotFoundError,
  RateLimitError,
  SandboxError,
  SandboxNotFoundError,
  isSandboxPortClosedMessage,
  isSandboxNotFoundMessage,
  SandboxUnreachableError,
  TimeoutError,
} from '../errors'
import { isNetworkError } from '../retry'
import { ENVD_DEFAULT_USER } from './versions'

/**
 * Sandbox health probe: resolves to `true` if the sandbox is running, `false` if it
 * is not, `undefined` if it answered but its state could not be determined, and
 * rejects when the sandbox could not be reached at all (no answer).
 */
export type SandboxHealthCheck = () => Promise<boolean | undefined>

/**
 * Message fragments different JS runtimes use when the connection to the sandbox
 * is dropped mid-request. The transport surfaces a dropped connection (e.g. an
 * HTTP/2 stream reset) with runtime- and version-specific wording, so we match
 * every known variant:
 *   - Node (undici):       `terminated`
 *   - Bun:                 `The socket connection was closed unexpectedly`
 *   - Deno:                `error reading a body from connection`
 *   - Cloudflare Workers:  `Network connection lost`
 *   - Browser:             `network error`
 */
const CONNECTION_TERMINATED_MESSAGES = [
  'terminated',
  'The socket connection was closed unexpectedly',
  'error reading a body from connection',
  'Network connection lost',
  'network error',
]

/**
 * Checks whether a message matches any known runtime variant of the connection to
 * the sandbox being dropped mid-request (see {@link CONNECTION_TERMINATED_MESSAGES}).
 */
export function isConnectionTerminatedMessage(
  message: string | undefined
): boolean {
  if (!message) {
    return false
  }

  return CONNECTION_TERMINATED_MESSAGES.some((fragment) =>
    message.includes(fragment)
  )
}

/**
 * Checks whether the error is the signature of the connection to the sandbox being
 * dropped mid-request — an HTTP/2 stream reset surfaced by connect as `Code.Unknown`
 * with one of the runtime-specific connection-dropped messages.
 */
function isConnectionTerminatedError(err: unknown): boolean {
  return (
    err instanceof ConnectError &&
    err.code === Code.Unknown &&
    isConnectionTerminatedMessage(err.rawMessage)
  )
}

/**
 * Checks whether the error is a transport-level failure of the request to the sandbox:
 * the connection could not be established or failed with a browser's opaque network
 * error (connect wraps the `fetch` rejection as `Code.Unknown` with the failure as
 * `cause`) or was dropped mid-request. Errors
 * envd responded with are never transport failures.
 */
export function isTransportFailure(err: unknown): boolean {
  if (isConnectionTerminatedError(err)) {
    return true
  }

  return (
    err instanceof ConnectError &&
    err.code === Code.Unknown &&
    isNetworkError(err.cause)
  )
}

/**
 * Builds the error for a request that failed at the connection level when the
 * follow-up health probe got no answer from the sandbox either. A probe answered
 * by the proxy with the sandbox running but envd's port not open is already a
 * `SandboxUnreachableError` and is kept, with the failed request as its cause.
 */
export function formatSandboxUnreachableError(
  err: Error,
  probeErr?: unknown
): Error {
  if (probeErr instanceof SandboxUnreachableError) {
    probeErr.cause = err
    return probeErr
  }
  return new SandboxUnreachableError(
    `${err.message}: The sandbox could not be reached. It was not confirmed to be stopped, so this is likely a transient network issue or envd inside the sandbox not being up yet — check the sandbox state with 'Sandbox.getInfo()' and retry the request.`,
    { cause: err }
  )
}

/**
 * Runs the health probe for a request that failed at the connection level and
 * returns the typed error for the outcome: a `TimeoutError` when the sandbox is
 * confirmed gone, a `SandboxUnreachableError` when the probe got no answer either,
 * or `undefined` when the sandbox answered (the failure was transient and the
 * original error applies).
 */
export async function resolveTransportFailure(
  err: Error,
  checkHealth: SandboxHealthCheck
): Promise<Error | undefined> {
  let running: boolean | undefined
  try {
    running = await checkHealth()
  } catch (probeErr) {
    return formatSandboxUnreachableError(err, probeErr)
  }

  if (running === false) {
    return new SandboxNotFoundError(
      `${err.message}: The sandbox was killed or reached its end of life while the request was in flight.`
    )
  }

  return undefined
}

const DEFAULT_ERROR_MAP: Partial<Record<Code, (message: string) => Error>> = {
  [Code.InvalidArgument]: (message) => new InvalidArgumentError(message),
  [Code.Unauthenticated]: (message) => new AuthenticationError(message),
  [Code.NotFound]: (message) => new NotFoundError(message),
  [Code.ResourceExhausted]: (message) =>
    new RateLimitError(
      `${message}: Rate limit exceeded, please try again later.`
    ),
  [Code.Unavailable]: formatSandboxUnavailableError,
  [Code.Canceled]: (message) =>
    new TimeoutError(
      `${message}: This error is likely due to exceeding 'requestTimeoutMs'. You can pass the request timeout value as an option when making the request.`
    ),
  [Code.DeadlineExceeded]: (message) =>
    new TimeoutError(
      `${message}: This error is likely due to exceeding 'timeoutMs' — the total time a long running request (like command execution or directory watch) can be active. It can be modified by passing 'timeoutMs' when making the request. Use '0' to disable the timeout.`
    ),
}

/**
 * Handles errors from envd RPC calls by mapping gRPC status codes to specific error types.
 *
 * @param err - The caught error, expected to be a `ConnectError` from the gRPC transport.
 * @param errorMap - Optional map of gRPC `Code` values to error factory functions that override the defaults.
 * @returns The corresponding `Error` instance mapped from the gRPC status code, or the original error if it is not a `ConnectError`.
 */
export function handleRpcError(
  err: unknown,
  errorMap?: Partial<Record<Code, (message: string) => Error>>
): Error {
  if (err instanceof ConnectError) {
    // Check if a custom error mapping is provided for this error code
    if (errorMap && err.code in errorMap) {
      return errorMap[err.code]!(err.message)
    }

    // Check if there is a default error mapping for this error code
    if (err.code in DEFAULT_ERROR_MAP) {
      return DEFAULT_ERROR_MAP[err.code]!(err.message)
    }

    // Fallback to a generic SandboxError if no specific mapping is found
    return new SandboxError(`${err.code}: ${err.message}`)
  }

  return err as Error
}

/**
 * Like {@link handleRpcError}, but when the request failed at the connection level
 * (the connection to the sandbox could not be established or was dropped
 * mid-request) it probes the sandbox health to tell apart the sandbox being killed
 * from the sandbox being unreachable or a transient network failure (e.g. a load
 * balancer dropping the connection). When the probe confirms the sandbox is gone, a
 * `TimeoutError` is returned — consistent with how requests to an already-dead
 * sandbox surface; when the probe gets no answer either, a `SandboxUnreachableError`.
 *
 * @param err - The caught error, expected to be a `ConnectError` from the gRPC transport.
 * @param checkHealth - Probe resolving to whether the sandbox is running (`undefined` when unknown) and rejecting when it cannot be reached.
 * @param errorMap - Optional map of gRPC `Code` values to error factory functions that override the defaults.
 * @returns The corresponding `Error` instance.
 */
/**
 * An `Unavailable` whose message is neither the proxy's "sandbox was not found" nor
 * "port is not open" — e.g. envd ending a stream while the sandbox is being killed —
 * does not tell whether the sandbox is gone; the health probe does.
 */
function isAmbiguousUnavailable(err: unknown): boolean {
  return (
    err instanceof ConnectError &&
    err.code === Code.Unavailable &&
    !isSandboxNotFoundMessage(err.rawMessage) &&
    !isSandboxPortClosedMessage(err.rawMessage)
  )
}

export async function handleRpcErrorWithHealthCheck(
  err: unknown,
  checkHealth?: SandboxHealthCheck,
  errorMap?: Partial<Record<Code, (message: string) => Error>>
): Promise<Error> {
  if (checkHealth && (isTransportFailure(err) || isAmbiguousUnavailable(err))) {
    const resolved = await resolveTransportFailure(
      err as ConnectError,
      checkHealth
    )
    if (resolved) {
      return resolved
    }
  }

  return handleRpcError(err, errorMap)
}

function encode64(value: string): string {
  switch (runtime) {
    case 'deno':
      return btoa(value)
    case 'node':
      return Buffer.from(value).toString('base64')
    case 'bun':
      return Buffer.from(value).toString('base64')
    default:
      return btoa(value)
  }
}

export function authenticationHeader(
  envdVersion: string,
  username: string | undefined
): Record<string, string> {
  if (
    username == undefined &&
    compareVersions(envdVersion, ENVD_DEFAULT_USER) < 0
  ) {
    username = defaultUsername
  }

  if (!username) {
    return {}
  }

  const value = `${username}:`

  const encoded = encode64(value)

  return { Authorization: `Basic ${encoded}` }
}

/**
 * Rejects a plain (non-Connect-encoded) 502 answered by the proxy in front of envd —
 * the sandbox is gone or envd's port is not open — as a `ConnectError` carrying the
 * proxy's message. connect reads that message for unary RPCs only; a streaming RPC
 * would otherwise surface it as a bare `HTTP 502`.
 */
export async function rejectProxyUnavailableResponse(
  res: Response
): Promise<Response> {
  if (res.status !== 502) {
    return res
  }

  let message = ''
  try {
    const body = await res.json()
    if (typeof body?.message === 'string') {
      message = body.message
    }
  } catch {
    // not a JSON body
  }

  throw new ConnectError(message || `HTTP ${res.status}`, Code.Unavailable)
}
