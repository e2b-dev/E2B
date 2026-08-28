/**
 * Optional context attached to an SDK error.
 */
export interface ErrorOpts {
  /**
   * Trace ID of the failed request, appended to the message.
   */
  traceId?: string
}

/**
 * Context for errors that can point somewhere other than where they were
 * constructed.
 */
export interface ErrorOptsWithStackTrace extends ErrorOpts {
  /**
   * Stack trace to use instead of the one captured where the error is
   * constructed, so the error points at the user's call site or at where the
   * failure happened server-side.
   */
  stackTrace?: string
}

function formatMessage(message?: string, traceId?: string) {
  return message && traceId ? `${message} (trace ID: ${traceId})` : message
}

// This is the message for the sandbox timeout error when the response code is 502/Unavailable
export function formatSandboxTimeoutError(message: string, opts?: ErrorOpts) {
  return new TimeoutError(
    `${message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`,
    opts
  )
}

/**
 * Base class for all sandbox errors.
 *
 * Thrown when general sandbox errors occur.
 */
export class SandboxError extends Error {
  /**
   * Trace ID of the failed request, when the response carried one.
   */
  readonly traceId?: string

  constructor(message?: string, opts?: ErrorOpts) {
    super(formatMessage(message, opts?.traceId))
    this.name = 'SandboxError'
    this.traceId = opts?.traceId
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
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'TimeoutError'
  }
}

/**
 * Thrown when an invalid argument is provided.
 */
export class InvalidArgumentError extends SandboxError {
  constructor(message: string, opts?: ErrorOptsWithStackTrace) {
    super(message, opts)
    this.name = 'InvalidArgumentError'
    if (opts?.stackTrace) {
      this.stack = opts.stackTrace
    }
  }
}

/**
 * Thrown when there is not enough disk space.
 */
export class NotEnoughSpaceError extends SandboxError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'NotEnoughSpaceError'
  }
}

/**
 * Thrown when a resource is not found.
 *
 * @deprecated Use {@link FileNotFoundError} or {@link SandboxNotFoundError} instead. This class will be removed in the next major version.
 */
export class NotFoundError extends SandboxError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'NotFoundError'
  }
}

/**
 * Thrown when a file or directory is not found inside a sandbox.
 */
export class FileNotFoundError extends NotFoundError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'FileNotFoundError'
  }
}

/**
 * Thrown when a sandbox is not found (e.g. it doesn't exist or is no longer running).
 */
export class SandboxNotFoundError extends NotFoundError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'SandboxNotFoundError'
  }
}

/**
 * Thrown when authentication fails.
 */
export class AuthenticationError extends Error {
  /**
   * Trace ID of the failed request, when the response carried one.
   */
  readonly traceId?: string

  constructor(message: string, opts?: ErrorOpts) {
    super(formatMessage(message, opts?.traceId))
    this.name = 'AuthenticationError'
    this.traceId = opts?.traceId
  }
}

/**
 * Thrown when git authentication fails.
 *
 * @deprecated Run git with `sandbox.commands.run()` instead. The git module will be removed in the next major version.
 */
export class GitAuthError extends AuthenticationError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'GitAuthError'
  }
}

/**
 * Thrown when git upstream tracking is missing.
 *
 * @deprecated Run git with `sandbox.commands.run()` instead. The git module will be removed in the next major version.
 */
export class GitUpstreamError extends SandboxError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'GitUpstreamError'
  }
}

/**
 * Thrown when the template uses old envd version. It isn't compatible with the new SDK.
 */
export class TemplateError extends SandboxError {
  constructor(message: string, opts?: ErrorOptsWithStackTrace) {
    super(message, opts)
    this.name = 'TemplateError'
    if (opts?.stackTrace) {
      this.stack = opts.stackTrace
    }
  }
}

/**
 * Thrown when the API rate limit is exceeded.
 */
export class RateLimitError extends SandboxError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'RateLimitError'
  }
}

/**
 * Thrown when the build fails.
 */
export class BuildError extends Error {
  /**
   * Trace ID of the failed request, when the response carried one.
   */
  readonly traceId?: string

  constructor(message: string, opts?: ErrorOptsWithStackTrace) {
    super(formatMessage(message, opts?.traceId))
    this.name = 'BuildError'
    this.traceId = opts?.traceId
    if (opts?.stackTrace) {
      this.stack = opts.stackTrace
    }
  }
}

/**
 * Thrown when the file upload fails.
 */
export class FileUploadError extends BuildError {
  constructor(message: string, opts?: ErrorOptsWithStackTrace) {
    super(message, opts)
    this.name = 'FileUploadError'
  }
}

/**
 * Base class for all volume errors.
 *
 * Thrown when general volume errors occur.
 */
export class VolumeError extends Error {
  /**
   * Trace ID of the failed request, when the response carried one.
   */
  readonly traceId?: string

  constructor(message: string, opts?: ErrorOpts) {
    super(formatMessage(message, opts?.traceId))
    this.name = 'VolumeError'
    this.traceId = opts?.traceId
  }
}

/**
 * Thrown when a volume is not found.
 */
export class VolumeNotFoundError extends VolumeError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'VolumeNotFoundError'
  }
}

/**
 * Thrown when a file or directory is not found inside a volume.
 */
export class VolumePathNotFoundError extends VolumeError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'VolumePathNotFoundError'
  }
}

/**
 * Base class for all secret errors.
 *
 * Thrown when general secret errors occur.
 */
export class SecretError extends Error {
  /**
   * Trace ID of the failed request, when the response carried one.
   */
  readonly traceId?: string

  constructor(message: string, opts?: ErrorOpts) {
    super(formatMessage(message, opts?.traceId))
    this.name = 'SecretError'
    this.traceId = opts?.traceId
  }
}

/**
 * Thrown when a secret is not found.
 */
export class SecretNotFoundError extends SecretError {
  constructor(message: string, opts?: ErrorOpts) {
    super(message, opts)
    this.name = 'SecretNotFoundError'
  }
}
