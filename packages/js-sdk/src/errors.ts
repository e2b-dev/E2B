// This is the message for the sandbox timeout error when the response code is 502/Unavailable
export function formatSandboxTimeoutError(message: string) {
  return new TimeoutError(
    `${message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`
  )
}

/**
 * Point an error's stack trace at `frames` (the user's call site, captured at
 * template-definition time) without losing information: `error.stack` is
 * synthesized as `Name: message\n<frames>` so reporters that print only
 * `error.stack` keep the failure message, and the error's original stack —
 * the actual throw site inside the SDK — stays reachable on `error.cause`.
 *
 * The header is composed lazily at read time so subclass constructors can
 * still assign `name` after this runs.
 *
 * @internal
 */
export function withStackTrace<E extends Error>(error: E, frames?: string): E {
  if (!frames) {
    return error
  }

  // Preserve the natural throw site — useful when debugging the SDK itself.
  const thrownAt = new Error('SDK-internal throw site')
  thrownAt.stack = error.stack
  error.cause = thrownAt

  Object.defineProperty(error, 'stack', {
    configurable: true,
    get: () => `${error.name}: ${error.message}\n${frames}`,
    set: (value: string | undefined) => {
      Object.defineProperty(error, 'stack', {
        value,
        writable: true,
        configurable: true,
      })
    },
  })

  return error
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
    withStackTrace(this, stackTrace)
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
 *
 * @deprecated Use {@link FileNotFoundError} or {@link SandboxNotFoundError} instead. This class will be removed in the next major version.
 */
export class NotFoundError extends SandboxError {
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'NotFoundError'
  }
}

/**
 * Thrown when a file or directory is not found inside a sandbox.
 */
export class FileNotFoundError extends NotFoundError {
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'FileNotFoundError'
  }
}

/**
 * Thrown when a sandbox is not found (e.g. it doesn't exist or is no longer running).
 */
export class SandboxNotFoundError extends NotFoundError {
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'SandboxNotFoundError'
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
 */
export class GitAuthError extends AuthenticationError {
  constructor(message: string) {
    super(message)
    this.name = 'GitAuthError'
  }
}

/**
 * Thrown when git upstream tracking is missing.
 */
export class GitUpstreamError extends SandboxError {
  constructor(message: string, stackTrace?: string) {
    super(message, stackTrace)
    this.name = 'GitUpstreamError'
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
    withStackTrace(this, stackTrace)
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
