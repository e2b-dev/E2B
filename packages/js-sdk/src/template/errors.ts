export class BuildError extends Error {
  constructor(message: string, stackTrace?: string) {
    super(message)
    this.name = 'BuildError'
    if (stackTrace) {
      this.stack = stackTrace
    }
  }
}

export class FileUploadError extends BuildError {
  constructor(message: string) {
    super(message)
    this.name = 'FileUploadError'
  }
}
