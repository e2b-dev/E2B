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
