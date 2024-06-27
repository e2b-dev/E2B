import { Code, ConnectError } from '@connectrpc/connect'

import { SandboxError, InvalidUserError, InvalidPathError, TimeoutError, formatSandboxTimeoutError } from '../errors'


export function handleRpcError(err: unknown): Error {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.InvalidArgument:
        return new InvalidUserError(err.message)
      case Code.NotFound:
        return new InvalidPathError(err.message)
      case Code.Unavailable:
        return formatSandboxTimeoutError(err.message)
      case Code.Canceled:
        return new TimeoutError(
          `${err.message}: This error is likely due to exceeding 'requestTimeoutMs'. You can pass the request timeout value as an option when making the request.`
        )
      case Code.DeadlineExceeded:
        return new TimeoutError(
          `${err.message}: This error is likely due to exceeding 'timeoutMs' — the total time a long running request (like process or directory watch) can be active. It can be modified by passing 'timeoutMs' when making the request. Use '0' to disable the timeout.`
        )
      default:
        return new SandboxError(`${err.code}: ${err.message}`)
    }
  }

  return err as Error
}
