/**
 * The type of timeout that occurred.
 *
 * - `sandbox` — the sandbox itself timed out (e.g., idle timeout expired).
 * - `request` — the HTTP request timed out (exceeded `requestTimeoutMs`).
 * - `execution` — a long-running operation timed out (exceeded `timeoutMs` for command execution, watch, etc.).
 */
export enum TimeoutType {
  /**
   * The sandbox itself timed out (e.g., idle timeout expired).
   */
  SANDBOX = 'sandbox',
  /**
   * The HTTP request timed out (exceeded `requestTimeoutMs`).
   */
  REQUEST = 'request',
  /**
   * A long-running operation timed out (exceeded `timeoutMs` for command execution, watch, etc.).
   */
  EXECUTION = 'execution',
}

// This is the message for the sandbox timeout error when the response code is 502/Unavailable
export function formatSandboxTimeoutError(message: string) {
  return new TimeoutError(
    `${message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`,
    undefined,
    TimeoutType.SANDBOX
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
 * The {@link type} property indicates the kind of timeout:
 *
 * - {@link TimeoutType.SANDBOX} — the sandbox itself timed out (idle timeout, etc.).
 * - {@link TimeoutType.REQUEST} — the HTTP request exceeded `requestTimeoutMs`.
 * - {@link TimeoutType.EXECUTION} — a long-running operation exceeded its `timeoutMs`.
 */
export class TimeoutError extends SandboxError {
  /**
   * The type of timeout that occurred.
   */
  readonly type: TimeoutType

  constructor(
    message: string,
    stackTrace?: string,
    type: TimeoutType = TimeoutType.SANDBOX
  ) {
    super(message, stackTrace)
    this.name = 'TimeoutError'
    this.type = type
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
