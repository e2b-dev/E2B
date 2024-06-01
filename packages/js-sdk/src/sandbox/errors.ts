export class SandboxError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'SandboxError'
  }
}

export class AuthenticationError extends SandboxError {
  constructor(message: any) {
    super(message)
    this.name = 'AuthenticationError'
  }
}
