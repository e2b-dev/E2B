// This is the message for the sandbox timeout error when the response code is 502/Unavailable
export function formatSandboxTimeoutError(message: string) {
  return new TimeoutError(
    `${message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`
  )
}

/**
 * Thrown when a sandbox error occurs.
 * 
 * Base class for all sandbox errors.
 */
export class SandboxError extends Error {
  constructor(message: any) {
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
 * The [deadline_exceeded] error type is caused by exceeding the timeout for process, watch, etc.
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
 * Thrown when an invalid user is provided.
 */
export class InvalidUserError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidUserError'
  }
}

/**
 * Thrown when an invalid path is provided.
 */
export class InvalidPathError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPathError'
  }
}

/**
 * Thrown when there is not enough disk space.
 */
export class NotEnoughDiskSpaceError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'NotEnoughDiskSpaceError'
  }
}

/**
 * Thrown when a resource is not found.
 */
export class NotFoundError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

/**
 * Thrown when authentication fails.
 */
export class AuthenticationError extends SandboxError {
  constructor(message: any) {
    super(message)
    this.name = 'AuthenticationError'
  }
}
