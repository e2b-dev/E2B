import {
  ProcessEvent_EndEvent,
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

export class ProcessHandle {
  private readonly end: Promise<{
    exit: ProcessEvent_EndEvent,
    stdout: Uint8Array[],
    stderr: Uint8Array[],
  }>

  constructor(
    readonly pid: number,
    private readonly handleDisconnect: () => void,
    private readonly handleKill: () => Promise<void>,
    events: AsyncIterable<ConnectResponse | StartResponse>,
    private readonly handleStdout?: ((data: string) => void | Promise<void>),
    private readonly handleStderr?: ((data: string) => void | Promise<void>),
    private readonly handlePtyData?: ((data: Uint8Array) => void | Promise<void>),
  ) {
    this.end = this.handleEvents(events)
  }

  private static joinUint8Arrays(arrays: Uint8Array[]) {
    const length = arrays.reduce((acc, cur) => acc + cur.length, 0)
    const result = new Uint8Array(length)
    let offset = 0

    for (const array of arrays) {
      result.set(array, offset)
      offset += array.length
    }

    return result
  }

  async wait(): Promise<ProcessResult> {
    const result = await this.end

    return {
      exitCode: result.exit.exitCode,
      error: result.exit.error,
      stdout: ProcessHandle.joinUint8Arrays(result.stdout).toString(),
      stderr: ProcessHandle.joinUint8Arrays(result.stderr).toString(),
    }
  }

  async kill() {
    this.handleDisconnect()
    await this.handleKill()
  }

  private async handleEvents(events: AsyncIterable<ConnectResponse | StartResponse>) {
    const stdout: Uint8Array[] = []
    const stderr: Uint8Array[] = []

    for await (const event of events) {
      switch (event.event?.event.case) {
        case 'data':
          switch (event.event.event.value.output.case) {
            case 'stdout':
              stdout.push(event.event.event.value.output.value)
              await this.handleStdout?.(event.event.event.value.output.value.toString())
              break
            case 'stderr':
              stderr.push(event.event.event.value.output.value)
              await this.handleStderr?.(event.event.event.value.output.value.toString())
              break
            case 'pty':
              await this.handlePtyData?.(event.event.event.value.output.value)
              break
          }
          break
        case 'end':
          return {
            exit: event.event.event.value,
            stdout,
            stderr,
          }
      }
    }

    throw new Error('Process ended without an end event')
  }
}

export interface ProcessResult {
  exitCode: number
  error?: string
  stdout: string
  stderr: string
}
