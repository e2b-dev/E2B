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

export class ProcessHandle<T = ""> {
  private rawStdout = new Uint8Array()
  private rawStderr = new Uint8Array()

  private _result?: ProcessResult

  constructor(
    readonly pid: number,
    private readonly handleDisconnect: () => void,
    private readonly handleKill: () => Promise<void>,
    private readonly outputs: OutputType[],
    private readonly events: AsyncIterable<ConnectResponse | StartResponse>,
  ) { }

  get result() {
    return this._result
  }

  async wait(
    onStdout?: ((data: string) => void | Promise<void>),
    onStderr?: ((data: string) => void | Promise<void>),
  ): Promise<ProcessResult> {
    for await (const event of this) {
      event
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
            this._result = {
              exitCode: event.value.exitCode,
              error: event.value.error,
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
