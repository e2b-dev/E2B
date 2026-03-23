import { Code, ConnectError } from '@connectrpc/connect'
import { runtime } from '../utils'

import { compareVersions } from 'compare-versions'
import { defaultUsername } from '../connectionConfig'
import {
  AuthenticationError,
  formatSandboxTimeoutError,
  InvalidArgumentError,
  NotFoundError,
  SandboxError,
  TimeoutError,
} from '../errors'
import { ENVD_DEFAULT_USER } from './versions'

const DEFAULT_ERROR_MAP: Partial<Record<Code, (message: string) => Error>> = {
  [Code.InvalidArgument]: (message) => new InvalidArgumentError(message),
  [Code.Unauthenticated]: (message) => new AuthenticationError(message),
  [Code.NotFound]: (message) => new NotFoundError(message),
  [Code.Unavailable]: (message) => formatSandboxTimeoutError(message),
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
