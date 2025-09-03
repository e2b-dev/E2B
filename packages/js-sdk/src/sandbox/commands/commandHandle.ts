import { handleRpcError } from '../../envd/rpc'
import { SandboxError } from '../../errors'
import { ConnectResponse, StartResponse } from '../../envd/process/process_pb'

declare const __brand: unique symbol
type Brand<B> = { [__brand]: B }
export type Branded<T, B> = T & Brand<B>

export type Stdout = Branded<string, 'stdout'>
export type Stderr = Branded<string, 'stderr'>
export type PtyOutput = Branded<Uint8Array, 'pty'>

/**
 * Command execution result.
 */
export interface CommandResult {
  /**
   * Command execution exit code.
   * `0` if the command finished successfully.
   */
  exitCode: number
  /**
   * Error message from command execution if it failed.
   */
  error?: string
  /**
   * Command stdout output.
   */
  stdout: string
  /**
   * Command stderr output.
   */
  stderr: string
}

/**
 * Error thrown when a command exits with a non-zero exit code.
 */
export class CommandExitError extends SandboxError implements CommandResult {
  constructor(private readonly result: CommandResult) {
    super(result.error)
    this.name = 'CommandExitError'
  }

  /**
   * Command execution exit code.
   * `0` if the command finished successfully.
   */
  get exitCode() {
    return this.result.exitCode
  }

  /**
   * Error message from command execution.
   */
  get error() {
    return this.result.error
  }

  /**
   * Command execution stdout output.
   */
  get stdout() {
    return this.result.stdout
  }

  /**
   * Command execution stderr output.
   */
  get stderr() {
    return this.result.stderr
  }
}

/**
 * Command execution handle.
 *
 * It provides methods for waiting for the command to finish, retrieving stdout/stderr, and killing the command.
 *
 * @property {number} pid process ID of the command.
 */
export class CommandHandle
  implements
    Omit<CommandResult, 'exitCode' | 'error'>,
    Partial<Pick<CommandResult, 'exitCode' | 'error'>>
{
  private _stdout = ''
  private _stderr = ''

  private result?: CommandResult
  private iterationError?: Error

  private readonly _wait: Promise<void>

  /**
   * @hidden
   * @internal
   * @access protected
   */
  constructor(
    readonly pid: number,
    private readonly handleDisconnect: () => void,
    private readonly handleKill: () => Promise<boolean>,
    private readonly events: AsyncIterable<ConnectResponse | StartResponse>,
    private readonly onStdout?: (stdout: string) => void | Promise<void>,
    private readonly onStderr?: (stderr: string) => void | Promise<void>,
    private readonly onPty?: (pty: Uint8Array) => void | Promise<void>
  ) {
    this._wait = this.handleEvents()
  }

  /**
   * Command execution exit code.
   * `0` if the command finished successfully.
   *
   * It is `undefined` if the command is still running.
   */
  get exitCode() {
    return this.result?.exitCode
  }

  /**
   * Error message from command execution.
   */
  get error() {
    return this.result?.error
  }

  /**
   * Command execution stderr output.
   */
  get stderr() {
    return this._stderr
  }

  /**
   * Command execution stdout output.
   */
  get stdout() {
    return this._stdout
  }

  /**
   * Wait for the command to finish and return the result.
   * If the command exits with a non-zero exit code, it throws a `CommandExitError`.
   *
   * @returns `CommandResult` result of command execution.
   */
  async wait() {
    await this._wait

    if (this.iterationError) {
      throw this.iterationError
    }

    if (!this.result) {
      throw new SandboxError('Process exited without a result')
    }

    if (this.result.exitCode !== 0) {
      throw new CommandExitError(this.result)
    }

    return this.result
  }

  /**
   * Disconnect from the command.
   *
   * The command is not killed, but SDK stops receiving events from the command.
   * You can reconnect to the command using {@link Commands.connect}.
   */
  async disconnect() {
    this.handleDisconnect()
  }

  /**
   * Kill the command.
   * It uses `SIGKILL` signal to kill the command.
   *
   * @returns `true` if the command was killed successfully, `false` if the command was not found.
   */
  async kill() {
    return await this.handleKill()
  }

  private async *iterateEvents(): AsyncGenerator<
    [Stdout, null, null] | [null, Stderr, null] | [null, null, PtyOutput]
  > {
    for await (const event of this.events) {
      const e = event?.event?.event
      let out: string | undefined

      switch (e?.case) {
        case 'data':
          switch (e.value.output.case) {
            case 'stdout':
              out = new TextDecoder().decode(e.value.output.value)
              this._stdout += out
              yield [out as Stdout, null, null]
              break
            case 'stderr':
              out = new TextDecoder().decode(e.value.output.value)
              this._stderr += out
              yield [null, out as Stderr, null]
              break
            case 'pty':
              yield [null, null, e.value.output.value as PtyOutput]
              break
          }
          break
        case 'end':
          this.result = {
            exitCode: e.value.exitCode,
            error: e.value.error,
            stdout: this.stdout,
            stderr: this.stderr,
          }
          break
      }
      // TODO: Handle empty events like in python SDK
    }
  }

  private async handleEvents() {
    try {
      for await (const [stdout, stderr, pty] of this.iterateEvents()) {
        if (stdout !== null) {
          this.onStdout?.(stdout)
        } else if (stderr !== null) {
          this.onStderr?.(stderr)
        } else if (pty) {
          this.onPty?.(pty)
        }
      }
    } catch (e) {
      this.iterationError = handleRpcError(e)
    }
  }
}
