import {
  ConnectResponse,
  StartResponse,
} from '../../envd/process/process_pb'


interface ProcessStdout {
  stdout: string
}

interface ProcessStderr {
  stderr: string
}

export type ProcessOutput = ProcessStdout | ProcessStderr


export class ProcessError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'ProcessError'
  }
}

export class ProcessExitError extends ProcessError implements ProcessResult {
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


export class ProcessHandle implements ProcessResult {
  private rawStdout = new Uint8Array()
  private rawStderr = new Uint8Array()

  private result?: ProcessResult

  constructor(
    readonly pid: number,
    private readonly handleDisconnect: () => void,
    private readonly handleKill: () => Promise<void>,
    private readonly events: AsyncIterable<ConnectResponse | StartResponse>,
  ) { }

  get exitCode() {
    return this.result?.exitCode
  }

  get stderr() {
    return this.rawStderr.toString()
  }

  get stdout() {
    return this.rawStdout.toString()
  }

  private static isProcessStdout(event: ProcessOutput | ProcessResult | undefined): event is ProcessStdout {
    return event !== undefined && 'stdout' in event
  }

  private static isProcessStderr(event: ProcessOutput | ProcessResult | undefined): event is ProcessStderr {
    return event !== undefined && 'stderr' in event
  }

  async wait({ onStderr, onStdout }: {
    onStdout?: (data: string) => void | Promise<void>,
    onStderr?: (data: string) => void | Promise<void>,
  } = {}): Promise<ProcessResult> {
    for await (const event of this) {
      if (ProcessHandle.isProcessStdout(event)) {
        onStdout?.(event.stdout)
      } else if (ProcessHandle.isProcessStderr(event)) {
        onStderr?.(event.stderr)
      }
    }

    if (!this.result) {
      throw new ProcessError('Process ended without an end event')
    }


    if (this.result.exitCode !== 0) {
      throw new ProcessExitError(this.result)
    }

    return this.result
  }

  async kill() {
    this.handleDisconnect()
    await this.handleKill()
  }

  [Symbol.asyncIterator]() {
    return {
      next: async (): Promise<IteratorResult<ProcessOutput, ProcessResult>> => {
        const event = await this.events[Symbol.asyncIterator]().next()

        const value: ConnectResponse | StartResponse = event.value

        switch (value.event?.event.case) {
          case 'data':
            switch (value.event.event.value.output.case) {
              case 'stdout':
                this.stdout += value.event.event.value.output.value.toString()
                return {
                  value: { stdout: value.event.event.value.output.value.toString() },
                  done: false,
                }
              case 'stderr':
                this.stderr += value.event.event.value.output.value.toString()
                return {
                  value: { stderr: value.event.event.value.output.value.toString() },
                  done: false,
                }
            }
            break
          case 'end':
            this.result = {
              exitCode: value.event.event.value.exitCode,
              error: value.event.event.value.error,
              stdout: this.stdout,
              stderr: this.stderr,
            }
            break
        }

        if (event.done && this.result) {
          return {
            done: true,
            value: this.result,
          }
        }

        throw new Error('Process ended without an end event')
      },
      return: async () => {
        return { value: this.result, done: true }
      },
      // throw: async () => {




      //   // throw new Error('Process ended without an end event')
      // }
    }
  }
}

export interface ProcessResult {
  exitCode: number
  error?: string
  stdout: string
  stderr: string
}
