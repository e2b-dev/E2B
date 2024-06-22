// This is the message for the sandbox timeout error when the response code is 502/Unavailable
export function formatSandboxTimeoutError(message: string) {
  return new TimeoutError(
    `${message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`
  )
}

export class SandboxError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'SandboxError'
  }
}
// [unknown] is sometimes caused by the sandbox timeout when the request is not processed
// [unavailable] is caused by sandbox timeout
// [canceled] is caused by exceeding request timeout
// [deadline_exceeded] is caused by exceeding the timeout (for process handlers, watch, etc)

export class TimeoutError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class InvalidUserError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidUserError'
  }
}

export class InvalidPathError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPathError'
  }
}

export class NotEnoughDiskSpaceError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'NotEnoughDiskSpaceError'
  }
}

export class NotFoundError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class AuthenticationError extends SandboxError {
  constructor(message: any) {
    super(message)
    this.name = 'AuthenticationError'
  }
}