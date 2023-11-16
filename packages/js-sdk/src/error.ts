export class TimeoutError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class AuthenticationError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class CurrentWorkingDirectoryDoesntExistError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'CurrentWorkingDirectoryDoesntExistError'
  }
}