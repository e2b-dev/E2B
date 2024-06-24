import { handleRpcError } from '../../envd/rpc'
import { SandboxError } from '../../errors'
import {
  ConnectResponse,
  StartResponse,
} from '../../envd/process/process_pb'

declare const __brand: unique symbol
type Brand<B> = { [__brand]: B }
export type Branded<T, B> = T & Brand<B>

export type Stdout = Branded<string, 'stdout'>
export type Stderr = Branded<string, 'stderr'>
export type Pty = Branded<Uint8Array, 'pty'>

export interface ProcessResult {
  exitCode: number
  error?: string
  stdout: string
  stderr: string
}

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

export class ProcessHandle implements Omit<ProcessResult, 'exitCode' | 'error'>, Partial<Pick<ProcessResult, 'exitCode' | 'error'>> {
  private _stdout = ''
  private _stderr = ''

  private result?: ProcessResult

  private readonly _wait: Promise<ProcessResult>

  constructor(
    readonly pid: number,
    private readonly handleDisconnect: () => void,
    private readonly handleKill: () => Promise<void>,
    private readonly events: AsyncIterable<ConnectResponse | StartResponse>,
    private readonly onStdout?: (stdout: string) => (void | Promise<void>),
    private readonly onStderr?: (stderr: string) => (void | Promise<void>),
    private readonly onPty?: (pty: Uint8Array) => (void | Promise<void>),
  ) {
    this._wait = this.handleEvents()
  }

  get exitCode() {
    return this.result?.exitCode
  }

  get error() {
    return this.result?.error
  }

  get stderr() {
    return this._stderr
  }

  get stdout() {
    return this._stdout
  }

  async wait() {
    return this._wait
  }

  async disconnect() {
    this.handleDisconnect()
  }

  async kill() {
    await this.disconnect()
    await this.handleKill()
  }

  private async* iterateEvents(): AsyncGenerator<[Stdout, undefined, undefined] | [undefined, Stderr, undefined] | [undefined, undefined, Pty]> {
    try {
      for await (const event of this.events) {
        const e = event?.event?.event
        let out: string | undefined

        switch (e?.case) {
          case 'data':
            switch (e.value.output.case) {
              case 'stdout':
                out = new TextDecoder().decode(e.value.output.value)
                this._stdout += out
                yield [out as Stdout, undefined, undefined]
                break
              case 'stderr':
                out = new TextDecoder().decode(e.value.output.value)
                this._stderr += out
                yield [undefined, out as Stderr, undefined]
                break
              case 'pty':
                yield [undefined, undefined, e.value.output.value as Pty]
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

            return this.result
        }
      }
    } catch (e) {
      throw handleRpcError(e)
    } finally {
      this.handleDisconnect()
    }
  }

  private async handleEvents(): Promise<ProcessResult> {
    for await (const [stdout, stderr, pty] of this.iterateEvents()) {
      if (stdout !== undefined) {
        this.onStdout?.(stdout)
      } else if (stderr !== undefined) {
        this.onStderr?.(stderr)
      } else if (pty) {
        this.onPty?.(pty)
      }
    }

    if (!this.result) {
      throw new SandboxError('Process exited without a result')
    }

    if (this.result.exitCode !== 0) {
      throw new ProcessExitError(this.result)
    }

    return this.result
  }
}
