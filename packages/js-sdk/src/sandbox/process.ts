import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'

import { ProcessService } from '../envd/process/v1/process_connect'
import {
  ProcessConfig as PsProcessConfig,
  ProcessEvent_EndEvent,
  ConnectResponse,
  ConnectRequest,
  SendInputRequest,
  StreamInputRequest,
  Signal,
  StartRequest,
  StartResponse,
  UpdateRequest,
} from '../envd/process/v1/process_pb'
import { ConnectionOpts } from '../connectionConfig'

export interface ProcessOutput {
  stdout?: string
  stderr?: string
}

export class ProcessHandle {
  private readonly end: Promise<{
    exit: ProcessEvent_EndEvent,
    stdout: Uint8Array[],
    stderr: Uint8Array[],
  }>

  constructor(
    readonly pid: number,
    readonly handleDisconnect: () => void,
    private readonly handleKill: () => Promise<void>,
    private readonly events: AsyncIterable<ConnectResponse | StartResponse>,
    private readonly handleStdout?: ((data: string) => void | Promise<void>),
    private readonly handleStderr?: ((data: string) => void | Promise<void>),
    private readonly handlePtyData?: ((data: Uint8Array) => void | Promise<void>),
  ) {
    this.end = this.handleEvents()
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

  disconnect() {
    this.handleDisconnect()
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
    this.disconnect()
    await this.handleKill()
  }

  private async handleEvents() {
    const stdout: Uint8Array[] = []
    const stderr: Uint8Array[] = []

    for await (const event of this.events) {
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

export interface ProcessResult extends ProcessOutput {
  exitCode: number
  error?: string
}

export type ProcessConfig = PlainMessage<PsProcessConfig>

// TODO: Sane defaults
// TODO: Add timeout to wait
// TODO: How to handle start + wait
// TODO: Move cwd resolution to envd?
// TODO: Should cwd be calculated in envd?
// TODO: More optional fields?
// TODO: Add req timeout
// TODO: Enable using process handle as iterable
// TODO: Solve stream input
// TODO: For watch and other stream ensure the timeout throw is handlable
// TODO: Create class from process handler
// TODO: Disconnect during kill
// TODO: Add iterator returns (python too)
// TODO: Passing timeout to envd context via metadata?
// TODO: Finish requestTimeoutMs handling in normal API
// TODO: Does the abort controller work when we specify the request timeout via connect rpc?
export class Process {
  protected readonly service: PromiseClient<typeof ProcessService> = createPromiseClient(ProcessService, this.transport)

  constructor(private readonly transport: Transport) { }

  async list(opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<ProcessConfig[]> {
    const res = await this.service.list({}, {
      timeoutMs: opts?.requestTimeoutMs,
    })
    return res.processes
  }

  async start(
    cmd: string,
    opts: {
      cwd?: string,
      user?: 'root' | 'user',
      envs?: Record<string, string>,
      onStdout?: ((data: string) => void | Promise<void>),
      onStderr?: ((data: string) => void | Promise<void>),
    } & Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<ProcessHandle> {
    const params: PlainMessage<StartRequest> = {
      owner: {
        credential: {
          case: 'username',
          value: opts.user || 'user',
        },
      },
      process: {
        cmd: '/bin/bash',
        cwd: opts.cwd,
        envs: opts.envs || {},
        args: ['-l', '-c', cmd],
      },
    }

    const controller = new AbortController()

    const events = this.service.start(params, {
      signal: controller.signal,
      timeoutMs: opts.requestTimeoutMs,
    })

    const startEvent: StartResponse = (await events[Symbol.asyncIterator]().next()).value

    if (startEvent.event?.event.case !== 'start') {
      throw new Error('Expected start event')
    }

    const pid = startEvent.event.event.value.pid

    return new ProcessHandle(
      pid,
      () => controller.abort(),
      () => this.kill(pid),
      events,
      opts.onStdout,
      opts.onStderr,
    )
  }

  async connect(
    pid: number,
    opts?: {
      onStdout?: ((data: string) => void | Promise<void>),
      onStderr?: ((data: string) => void | Promise<void>),
    } & Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<ProcessHandle> {
    const params: PlainMessage<ConnectRequest> = {
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
    }
    const controller = new AbortController()

    const events = this.service.connect(params, {
      signal: controller.signal,
      timeoutMs: opts?.requestTimeoutMs,
    })

    return new ProcessHandle(
      pid,
      () => controller.abort(),
      () => this.kill(pid),
      events,
      opts?.onStdout,
      opts?.onStderr,
    )
  }

  async kill(pid: number, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<void> {
    await this.service.sendSignal({
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
      signal: Signal.SIGKILL,
    }, {
      timeoutMs: opts?.requestTimeoutMs,
    })
  }

  async sendStdin(pid: number, data: Uint8Array, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<void> {
    const params: PlainMessage<SendInputRequest> = {
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
      input: {
        input: {
          case: 'stdin',
          value: data,
        },
      },
    }

    await this.service.sendInput(params, {
      timeoutMs: opts?.requestTimeoutMs,
    })
  }

  async startTerminal({ cols, rows, onData }: {
    cols: number,
    rows: number,
    onData: (data: Uint8Array) => void | Promise<void>,
  }, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<ProcessHandle> {
    const params: PlainMessage<StartRequest> = {
      owner: {
        credential: {
          case: 'username',
          value: 'user',
        },
      },
      process: {
        cmd: '/bin/bash',
        envs: {},
        args: ['-i', '-l'],
      },
      pty: {
        size: {
          cols,
          rows,
        },
      },
    }

    const controller = new AbortController()

    const events = this.service.start(params, {
      timeoutMs: opts?.requestTimeoutMs,
      signal: controller.signal,
    })

    const startEvent: StartResponse = (await events[Symbol.asyncIterator]().next()).value

    if (startEvent.event?.event.case !== 'start') {
      throw new Error('Expected start event')
    }

    const pid = startEvent.event.event.value.pid

    return new ProcessHandle(
      pid,
      () => controller.abort(),
      () => this.kill(pid),
      events,
      undefined,
      undefined,
      onData,
    )
  }

  async resizeTerminal(
    pid: number,
    size: {
      cols: number,
      rows: number,
    },
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>,
  ): Promise<void> {
    const params: PlainMessage<UpdateRequest> = {
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
      pty: {
        size,
      },
    }

    await this.service.update(params, {
      timeoutMs: opts?.requestTimeoutMs,
    })
  }

  private async streamTerminalInput(params: AsyncIterable<PlainMessage<StreamInputRequest>>, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>) {
    const controller = new AbortController()

    this.service.streamInput(params, {
      signal: controller.signal,
      timeoutMs: opts?.requestTimeoutMs,
    })

    return {
      stop: () => controller.abort(),
    }
  }
}
