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
  ProcessEvent_StartEvent,
  ConnectResponse,
  ConnectRequest,
  SendInputRequest,
  StreamInputRequest,
  Signal,
  StartRequest,
  StartResponse,
  UpdateRequest,
} from '../envd/process/v1/process_pb'
import { concatUint8Arrays } from './array'
import { createDeferredPromise } from './promise'


export interface ProcessOutput {
  stdout?: string
  stderr?: string
}

export interface ProcessHandle {
  pid: number
  disconnect: () => void
  wait: () => Promise<ProcessResult>
  kill: () => Promise<void>
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
export class Process {
  private readonly service: PromiseClient<typeof ProcessService> = createPromiseClient(ProcessService, this.transport)

  constructor(private readonly transport: Transport) { }

  async list(): Promise<ProcessConfig[]> {
    const res = await this.service.list({})
    return res.processes
  }

  async start(
    cmd: string,
    {
      cwd,
      user,
      envs,
      onStderr,
      onStdout,
    }: {
      cwd?: string,
      user?: string,
      envs?: Record<string, string>,
      onStdout?: (data: string) => any,
      onStderr?: (data: string) => any,
    }
  ): Promise<ProcessHandle> {
    const params: PlainMessage<StartRequest> = {
      owner: {
        credential: {
          case: 'username',
          value: user || 'user',
        },
      },
      process: {
        cmd: '/bin/bash',
        cwd: cwd || '/',
        envs: envs || {},
        args: ['-c', '-l', cmd],
      },
    }

    const controller = new AbortController()

    const events = this.service.start(params, {
      signal: controller.signal,
    })

    const {
      start,
      wait,
    } = await this.handleProcessEvents(events, {
      onStdout,
      onStderr,
    })

    const startEvent = await start

    return {
      pid: startEvent.pid,
      disconnect: () => controller.abort(),
      wait,
      kill: () => this.kill(startEvent.pid),
    }
  }

  async connect(
    pid: number,
    {
      onStderr,
      onStdout,
    }: {
      onStdout?: (data: string) => any,
      onStderr?: (data: string) => any,
    }
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
    })

    const {
      wait,
    } = await this.handleProcessEvents(events, {
      onStdout,
      onStderr,
    })

    return {
      pid,
      disconnect: () => controller.abort(),
      wait,
      kill: () => this.kill(pid),
    }
  }

  async kill(pid: number): Promise<void> {
    await this.service.sendSignal({
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
      signal: Signal.SIGKILL,
    })
  }

  async sendStdin(pid: number, data: Uint8Array): Promise<void> {
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

    await this.service.sendInput(params)
  }

  async startTerminal({ cols, rows, onData }: {
    cols: number,
    rows: number,
    onData: (data: Uint8Array) => any,
  }): Promise<void> {
    const params: PlainMessage<StartRequest> = {
      owner: {
        credential: {
          case: 'username',
          value: 'user',
        },
      },
      process: {
        cmd: '/bin/bash',
        cwd: '/',
        envs: {},
        args: ['-l'],
      },
      pty: {
        size: {
          cols,
          rows,
        },
      },
    }

    const start = createDeferredPromise<ProcessEvent_StartEvent>()
    const end = createDeferredPromise<ProcessEvent_EndEvent>()

    const stream = this.service.start(params)

    async function processStream() {
      try {
        for await (const event of stream) {
          switch (event.event?.event.case) {
            case 'start':
              start.resolve(event.event.event.value)
              break
            case 'data':
              switch (event.event.event.value.output.case) {
                case 'pty':
                  onData(event.event.event.value.output.value)
                  break
              }
              break
            case 'end':
              end.resolve(event.event.event.value)
              break
          }

        }
      } catch (error) {
        start.reject(error)
        end.reject(error)
      }
    }

    processStream()

    const startEvent = await start.promise


    return

  }

  private async resizeTerminal(pid: number, size: {
    cols: number,
    rows: number,
  }): Promise<void> {
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

    await this.service.update(params)
  }

  private async streamTerminalInput(params: AsyncIterable<PlainMessage<StreamInputRequest>>) {
    const controller = new AbortController()

    this.service.streamInput(params, {
      signal: controller.signal,
    })

    return {
      stop: () => controller.abort(),
    }
  }

  private async handleProcessEvents(
    events: AsyncIterable<StartResponse | ConnectResponse>,
    {
      onStderr,
      onStdout,
    }: {
      onStdout?: (data: string) => any,
      onStderr?: (data: string) => any,
    }
  ) {
    const start = createDeferredPromise<ProcessEvent_StartEvent>()
    const end = createDeferredPromise<{
      exit: ProcessEvent_EndEvent,
      stdout: Uint8Array[],
      stderr: Uint8Array[],
    }>()

    async function processStream() {
      const stdout: Uint8Array[] = []
      const stderr: Uint8Array[] = []

      try {
        for await (const event of events) {
          switch (event.event?.event.case) {
            case 'start':
              start.resolve(event.event.event.value)
              break
            case 'data':
              switch (event.event.event.value.output.case) {
                case 'stdout':
                  stdout.push(event.event.event.value.output.value)
                  onStdout?.(event.event.event.value.output.value.toString())
                  break
                case 'stderr':
                  stderr.push(event.event.event.value.output.value)
                  onStderr?.(event.event.event.value.output.value.toString())
                  break
              }
              break
            case 'end':
              end.resolve({
                exit: event.event.event.value,
                stdout,
                stderr,
              })
              break
          }

        }
      } catch (error) {
        start.reject(error)
        end.reject(error)
      }
    }

    processStream()

    return {
      start: start.promise,
      wait: async () => {
        const { exit, stdout, stderr } = await end.promise
        return {
          ...exit,
          get stdout() {
            return concatUint8Arrays(stdout).toString()
          },
          get stderr() {
            return concatUint8Arrays(stderr).toString()
          },
        }
      },
      // async *[Symbol.asyncIterator](): AsyncIterable<ProcessOutput> {
      //   for (const delay of this.delays) {
      //     await this.wait(delay)
      //     yield `Delayed response for ${delay} milliseconds`
      //   }
      // },
    }
  }
}
