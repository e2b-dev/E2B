import { SandboxError } from 'e2b'

/**
 * Desktop startup failed and the allocated sandbox could not be confirmed killed.
 *
 * The sandbox may still be running. Use `sandboxId` for targeted cleanup, inspect
 * `cause` for the original startup failure, and `cleanupError` for the kill failure.
 */
export class DesktopStartupError extends SandboxError {
  readonly sandboxId: string
  /** Original startup rejection. JavaScript can reject non-Error values. */
  readonly cause: unknown
  /** Original kill rejection, which can also be a non-Error value. */
  readonly cleanupError: unknown

  /**
   * @param sandboxId ID of the allocated sandbox whose cleanup failed.
   * @param startupError Original startup rejection, including non-Error values.
   * @param cleanupError Original cleanup rejection, including non-Error values.
   */
  constructor(sandboxId: string, startupError: unknown, cleanupError: unknown) {
    super(
      `Desktop startup failed and cleanup of sandbox ${sandboxId} could not be confirmed. ` +
        `The sandbox may still be running - reclaim it with \`Sandbox.kill('${sandboxId}')\`.`
    )
    this.name = 'DesktopStartupError'
    this.sandboxId = sandboxId
    this.cause = startupError
    this.cleanupError = cleanupError
  }
}
