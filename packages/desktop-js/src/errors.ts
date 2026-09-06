import { SandboxError } from 'e2b'

/**
 * Desktop startup failed and the allocated sandbox could not be confirmed killed.
 *
 * The sandbox may still be running. Use `sandboxId` for targeted cleanup, inspect
 * `cause` for the original startup failure, and `cleanupError` for the kill failure.
 */
export class DesktopStartupError extends SandboxError {
  readonly sandboxId: string
  readonly cause: unknown
  readonly cleanupError: unknown

  constructor(sandboxId: string, startupError: unknown, cleanupError: unknown) {
    super('Desktop startup failed and sandbox cleanup could not be confirmed.')
    this.name = 'DesktopStartupError'
    this.sandboxId = sandboxId
    this.cause = startupError
    this.cleanupError = cleanupError
  }
}
