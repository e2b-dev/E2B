// Messages of the 502 the proxy in front of envd answers with when the sandbox does
// not exist anymore (killed or reached its timeout) or when it is running but envd's
// port is not open (e.g. its network is down).
const SANDBOX_NOT_FOUND_MESSAGE = 'was not found'
const SANDBOX_PORT_NOT_OPEN_MESSAGE = 'port is not open'

export function isSandboxNotFoundMessage(message: string): boolean {
  return message.includes(SANDBOX_NOT_FOUND_MESSAGE)
}

export function isSandboxPortNotOpenMessage(message: string): boolean {
  return message.includes(SANDBOX_PORT_NOT_OPEN_MESSAGE)
}

/**
 * Maps a 502/Unavailable answered by the proxy in front of envd: the sandbox was not
 * found (killed or reached its timeout) is a `SandboxNotRunningError`; the sandbox
 * running but envd's port not open (e.g. its network is down) a
 * `SandboxUnreachableError`; any other message (e.g. envd ending a stream because
 * the connection to the sandbox was lost) a `SandboxUnreachableError` too, with the
 * sandbox state reported as unknown.
 */
export function formatSandboxUnavailableError(message: string): Error {
  if (isSandboxNotFoundMessage(message)) {
    return new SandboxNotRunningError(
      `${message}: The sandbox was killed or reached its timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`
    )
  }
  if (isSandboxPortNotOpenMessage(message)) {
    return new SandboxUnreachableError(
      `${message}: The sandbox is running but envd inside it could not be reached (e.g. its network is down). Check the sandbox state with 'Sandbox.getInfo()'.`
    )
  }
  return new SandboxUnreachableError(
    `${message}: The sandbox could not be reached and its state is unknown — it may have been killed or reached its timeout, or the connection to it was lost. Check the sandbox state with 'Sandbox.getInfo()'.`
  )
}

/**
 * Base class for all sandbox errors.
 *
 * Thrown when general sandbox errors occur.
 */
export class SandboxError extends Error {
  /**
   * HTTP status of the API response that produced this error, when there was one.
   */
  statusCode?: number

  constructor(message?: string) {
    super(message)
    this.name = 'SandboxError'
  }
}

/**
 * Thrown when a timeout error occurs.
 *
 * The [unavailable] error type is caused by sandbox timeout.
 *
 * The [canceled] error type is caused by exceeding request timeout.
 *
 * The [deadline_exceeded] error type is caused by exceeding the timeout for command execution, watch, etc.
 *
 * The [unknown] error type is sometimes caused by the sandbox timeout when the request is not processed correctly.
 */
export class TimeoutError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Thrown when an invalid argument is provided.
 */
export class InvalidArgumentError extends SandboxError {
  constructor(message: string, stackTrace?: string) {
    super(message)
    this.name = 'InvalidArgumentError'
    if (stackTrace) {
      this.stack = stackTrace
    }
  }
}

/**
 * Thrown when there is not enough disk space.
 */
export class NotEnoughSpaceError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'NotEnoughSpaceError'
  }
}

/**
 * Thrown when a resource is not found.
 *
 * @deprecated Use {@link FileNotFoundError} or {@link SandboxNotFoundError} instead. This class will be removed in the next major version.
 */
export class NotFoundError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

/**
 * Thrown when a file or directory is not found inside a sandbox.
 */
export class FileNotFoundError extends NotFoundError {
  constructor(message: string) {
    super(message)
    this.name = 'FileNotFoundError'
  }
}

/**
 * Thrown when a sandbox is not found (e.g. it doesn't exist or is no longer running).
 */
export class SandboxNotFoundError extends NotFoundError {
  constructor(message: string) {
    super(message)
    this.name = 'SandboxNotFoundError'
  }
}

/**
 * Thrown when the sandbox is not running anymore: the proxy in front of it
 * answered a request (or the health probe run after a request failed at the
 * connection level) with the sandbox not found — it was killed, paused or
 * reached its timeout. Retrying the request will not help; create or resume a
 * sandbox.
 *
 * The split from `SandboxUnreachableError` is only as good as the proxy's answer
 * and the health probe: a sandbox that is gone but could not be asked about is a
 * `SandboxUnreachableError`. Starting a command, PTY or directory watch on a
 * sandbox that is gone throws `SandboxNotFoundError` instead (as it always did), so
 * handlers that want every "sandbox is gone" case have to catch both this class
 * and `SandboxNotFoundError` until the next major version.
 *
 * Subclass of `TimeoutError`, which this case surfaced as before.
 */
export class SandboxNotRunningError extends TimeoutError {
  constructor(message: string, options?: ErrorOptions) {
    super(message)
    this.name = 'SandboxNotRunningError'
    if (options?.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

/**
 * Thrown when the sandbox could not be reached while it is not confirmed to be
 * stopped: the proxy in front of the sandbox reports it running but envd's port
 * not open (e.g. the sandbox's network is down), the proxy or envd answered
 * with an unavailability the health probe could not resolve (e.g. the connection
 * to the sandbox was lost mid-stream while the probe found it running), or a
 * request failed at the connection level (the connection could not be
 * established or was dropped mid-request) and the follow-up health probe got
 * no answer from the sandbox either. A sandbox confirmed stopped (or paused) is
 * a `SandboxNotRunningError` — but only as far as the probe can tell: a sandbox
 * that is gone and could not be asked about surfaces here.
 *
 * This usually means the sandbox's network is down, envd inside it is not up
 * (yet), or a network issue between the client and the sandbox. Check the
 * sandbox state with `Sandbox.getInfo()`.
 *
 * Subclass of `TimeoutError`, which these cases surfaced as before.
 */
export class SandboxUnreachableError extends TimeoutError {
  constructor(message: string, options?: ErrorOptions) {
    super(message)
    this.name = 'SandboxUnreachableError'
    if (options?.cause !== undefined) {
      this.cause = options.cause
    }
  }
}

/**
 * Thrown when authentication fails.
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Thrown when git authentication fails.
 *
 * @deprecated Run git with `sandbox.commands.run()` instead. The git module will be removed in the next major version.
 */
export class GitAuthError extends AuthenticationError {
  constructor(message: string) {
    super(message)
    this.name = 'GitAuthError'
  }
}

/**
 * Thrown when git upstream tracking is missing.
 *
 * @deprecated Run git with `sandbox.commands.run()` instead. The git module will be removed in the next major version.
 */
export class GitUpstreamError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'GitUpstreamError'
  }
}

/**
 * Thrown when the template uses old envd version. It isn't compatible with the new SDK.
 */
export class TemplateError extends SandboxError {
  constructor(message: string, stackTrace?: string) {
    super(message)
    this.name = 'TemplateError'
    if (stackTrace) {
      this.stack = stackTrace
    }
  }
}

/**
 * Thrown when the API rate limit is exceeded.
 */
export class RateLimitError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
    this.statusCode = 429
  }
}

/**
 * Thrown when the API refused the operation because the service is
 * temporarily busy (HTTP 503): no capacity to place a sandbox right now, or
 * the node running the sandbox declined a request it cannot serve yet.
 *
 * Nothing was changed by the refused call: for example a refused pause
 * leaves the sandbox running with its state intact, so the same call can be
 * retried after a short wait.
 *
 * Like {@link AuthenticationError} and unlike the other API errors, this is
 * not a {@link SandboxError}: it is raised for every 503 whatever the
 * operation, so catch it explicitly.
 */
export class ServiceBusyError extends Error {
  /**
   * HTTP status of the API response: always 503.
   */
  readonly statusCode = 503

  constructor(message: string) {
    super(message)
    this.name = 'ServiceBusyError'
  }
}

/**
 * Thrown when the build fails.
 */
export class BuildError extends Error {
  constructor(message: string, stackTrace?: string) {
    super(message)
    this.name = 'BuildError'
    if (stackTrace) {
      this.stack = stackTrace
    }
  }
}

/**
 * Thrown when the file upload fails.
 */
export class FileUploadError extends BuildError {
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'FileUploadError'
  }
}

/**
 * Base class for all volume errors.
 *
 * Thrown when general volume errors occur.
 */
export class VolumeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VolumeError'
  }
}

/**
 * Thrown when a volume is not found.
 */
export class VolumeNotFoundError extends VolumeError {
  constructor(message: string) {
    super(message)
    this.name = 'VolumeNotFoundError'
  }
}

/**
 * Thrown when a file or directory is not found inside a volume.
 */
export class VolumePathNotFoundError extends VolumeError {
  constructor(message: string) {
    super(message)
    this.name = 'VolumePathNotFoundError'
  }
}

/**
 * Base class for all secret errors.
 *
 * Thrown when general secret errors occur.
 */
export class SecretError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretError'
  }
}

/**
 * Thrown when a secret is not found.
 */
export class SecretNotFoundError extends SecretError {
  constructor(message: string) {
    super(message)
    this.name = 'SecretNotFoundError'
  }
}
