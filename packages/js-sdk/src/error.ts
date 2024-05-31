export class AuthenticationError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'AuthenticationError'
  }
}
