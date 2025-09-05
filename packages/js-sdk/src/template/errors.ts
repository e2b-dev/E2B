export class BuildError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BuildError'
  }
}

export class FileUploadError extends BuildError {
  constructor(message: string) {
    super(message)
    this.name = 'FileUploadError'
  }
}
