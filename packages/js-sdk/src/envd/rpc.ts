import { Code, ConnectError } from '@connectrpc/connect'
import { runtime } from '../utils'

import { compareVersions } from 'compare-versions'
import { defaultUsername } from '../connectionConfig'
import {
  AuthenticationError,
  formatSandboxTimeoutError,
  InvalidArgumentError,
  NotFoundError,
  RateLimitError,
  SandboxError,
  TimeoutError,
} from '../errors'
import { ENVD_DEFAULT_USER } from './versions'

/**
 * Result of a sandbox health probe: `true` if the sandbox is running, `false` if it is not,
 * `undefined` if its state could not be determined.
 */
export type SandboxHealthCheck = () => Promise<boolean | undefined>

/**
 * Checks whether the error is the signature of the connection to the sandbox being
 * dropped mid-request — an HTTP/2 stream reset surfaced by connect as `Code.Unknown`
 * with the message 'terminated'.
 */
export function isConnectionTerminatedError(err: unknown): boolean {
  return (
    err instanceof ConnectError &&
    err.code === Code.Unknown &&
    err.rawMessage === 'terminated'
  )
}

const DEFAULT_ERROR_MAP: Partial<Record<Code, (message: string) => Error>> = {
  [Code.InvalidArgument]: (message) => new InvalidArgumentError(message),
  [Code.Unauthenticated]: (message) => new AuthenticationError(message),
  [Code.NotFound]: (message) => new NotFoundError(message),
  [Code.ResourceExhausted]: (message) =>
    new RateLimitError(
      `${message}: Rate limit exceeded, please try again later.`
    ),
  [Code.Unavailable]: formatSandboxTimeoutError,
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
 * Like {@link handleRpcError}, but when the connection to the sandbox was dropped
 * mid-request it probes the sandbox health to tell apart the sandbox being killed
 * from a transient network failure (e.g. a load balancer dropping the connection).
 *
 * @param err - The caught error, expected to be a `ConnectError` from the gRPC transport.
 * @param checkHealth - Probe returning whether the sandbox is running, or `undefined` when unknown.
 * @param errorMap - Optional map of gRPC `Code` values to error factory functions that override the defaults.
 * @returns The corresponding `Error` instance.
 */
export async function handleRpcErrorWithHealthCheck(
  err: unknown,
  checkHealth?: SandboxHealthCheck,
  errorMap?: Partial<Record<Code, (message: string) => Error>>
): Promise<Error> {
  if (isConnectionTerminatedError(err) && checkHealth) {
    const running = await checkHealth().catch(() => undefined)

    if (running === false) {
      return new SandboxError(
        `${(err as ConnectError).message}: The sandbox was killed or reached its end of life while the request was in flight.`
      )
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
