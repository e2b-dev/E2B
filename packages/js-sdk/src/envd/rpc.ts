import { Code, ConnectError } from '@connectrpc/connect'
import { runtime } from '../utils'
import { defaultUsername } from '../connectionConfig'

import {
  SandboxError,
  TimeoutError,
  formatSandboxTimeoutError,
  InvalidArgumentError,
  NotFoundError,
  AuthenticationError,
} from '../errors'

export function handleRpcError(err: unknown): Error {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.InvalidArgument:
        return new InvalidArgumentError(err.message)
      case Code.Unauthenticated:
        return new AuthenticationError(err.message)
      case Code.NotFound:
        return new NotFoundError(err.message)
      case Code.Unavailable:
        return formatSandboxTimeoutError(err.message)
      case Code.Canceled:
        return new TimeoutError(
          `${err.message}: This error is likely due to exceeding 'requestTimeoutMs'. You can pass the request timeout value as an option when making the request.`
        )
      case Code.DeadlineExceeded:
        return new TimeoutError(
          `${err.message}: This error is likely due to exceeding 'timeoutMs' — the total time a long running request (like command execution or directory watch) can be active. It can be modified by passing 'timeoutMs' when making the request. Use '0' to disable the timeout.`
        )
      default:
        return new SandboxError(`${err.code}: ${err.message}`)
    }
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
  username?: string
): Record<string, string> {
  const value = `${username || defaultUsername}:`

  const encoded = encode64(value)

  return { Authorization: `Basic ${encoded}` }
}
