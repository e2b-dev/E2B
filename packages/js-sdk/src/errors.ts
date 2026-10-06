// Message of the 502 the proxy in front of envd answers with when the sandbox
// is running but nothing listens on envd's port — e.g. its network is down.
const SANDBOX_PORT_CLOSED_MESSAGE = 'port is not open'

export function isSandboxPortClosedMessage(message: string): boolean {
  return message.includes(SANDBOX_PORT_CLOSED_MESSAGE)
}

// This is the message for the sandbox timeout error when the response code is 502/Unavailable
export function formatSandboxTimeoutError(message: string) {
  return new TimeoutError(
    `${message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`
  )
}

/**
 * Maps a 502/Unavailable answered by the proxy in front of envd: the sandbox is
 * gone (killed or timed out) unless the proxy reports it running with envd's port
 * not open, in which case the sandbox is unreachable.
 */
export function formatSandboxUnavailableError(message: string): Error {
  if (isSandboxPortClosedMessage(message)) {
    return new SandboxUnreachableError(
      `${message}: envd inside the sandbox could not be reached although the sandbox is running — e.g. its network is down. Check the sandbox state with 'Sandbox.getInfo()' and retry the request.`
    )
  }
  return formatSandboxTimeoutError(message)
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
 * Thrown when the sandbox could not be reached while not confirmed to be
 * stopped: either the proxy in front of the sandbox reports it running but
 * envd's port not open (e.g. the sandbox's network is down), or a request
 * failed at the connection level (the connection could not be established or
 * was dropped mid-request) and a follow-up health probe got no answer from the
 * sandbox either.
 *
 * This usually means the sandbox's network is down, envd inside it is not up
 * (yet), or a transient network issue between the client and the sandbox.
 * Check the sandbox state with `Sandbox.getInfo()` and retry the request.
 */
export class SandboxUnreachableError extends SandboxError {
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
