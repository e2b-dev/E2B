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
 * Result of a process execution.
 */
export interface ProcessResult {
  exitCode: number
  error?: string
  stdout: string
  stderr: string
}

/**
 * Error thrown when a process exits with a non-zero exit code.
 */
export class ProcessExitError extends SandboxError implements ProcessResult {
  constructor(private readonly result: ProcessResult) {
    super(result.error)
    this.name = 'ProcessExitError'
  }

  get exitCode() {
    return this.result.exitCode
  }

  get error() {
    return this.result.error
  }

  get stdout() {
    return this.result.stdout
  }

  get stderr() {
    return this.result.stderr
  }
}

/**
 * Represents a process object. It provides methods for waiting for the finish and killing the process.
 */
export class ProcessHandle
  implements
    Omit<ProcessResult, 'exitCode' | 'error'>,
    Partial<Pick<ProcessResult, 'exitCode' | 'error'>>
{
  private _stdout = ''
  private _stderr = ''

  private result?: ProcessResult
  private iterationError?: Error

  private readonly _wait: Promise<void>

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
   * Exit code of the process. It is `undefined` if the process is still running.
   */
  get exitCode() {
    return this.result?.exitCode
  }

  /**
   * Error message of the process. It is `undefined` if the process is still running.
   */
  get error() {
    return this.result?.error
  }

  /**
   * Stderr of the process.
   */
  get stderr() {
    return this._stderr
  }

  /**
   * Stdout of the process.
   */
  get stdout() {
    return this._stdout
  }

  /**
   * Waits for the process to finish and returns the result.
   * If the process exits with a non-zero exit code, it throws a `ProcessExitError`.
   * @returns Process result
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
      throw new ProcessExitError(this.result)
    }

    return this.result
  }

  /**
   * Disconnects from the process. It does not kill the process. It only stops receiving events from the process.
   */
  async disconnect() {
    this.handleDisconnect()
  }

  /**
   * Kills the process.
   * @returns Whether the process was killed successfully
   */
  async kill() {
    await this.handleKill()
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
