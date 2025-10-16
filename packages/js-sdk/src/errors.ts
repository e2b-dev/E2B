// This is the message for the sandbox timeout error when the response code is 502/Unavailable
export function formatSandboxTimeoutError(message: string) {
  return new TimeoutError(
    `${message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`
  )
}

/**
 * Base class for all sandbox errors.
 *
 * Thrown when general sandbox errors occur.
 */
export class SandboxError extends Error {
  constructor(message?: string, stackTrace?: string) {
    super(message)
    this.name = 'SandboxError'
    if (stackTrace) {
      this.stack = stackTrace
    }
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
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'TimeoutError'
  }
}

/**
 * Thrown when an invalid argument is provided.
 */
export class InvalidArgumentError extends SandboxError {
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'InvalidArgumentError'
  }
}

/**
 * Thrown when there is not enough disk space.
 */
export class NotEnoughSpaceError extends SandboxError {
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'NotEnoughSpaceError'
  }
}

/**
 * Thrown when a resource is not found.
 */
export class NotFoundError extends SandboxError {
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'NotFoundError'
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
 * Thrown when the template uses old envd version. It isn't compatible with the new SDK.
 */
export class TemplateError extends SandboxError {
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'TemplateError'
  }
}

/**
 * Thrown when the API rate limit is exceeded.
 */
export class RateLimitError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
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
