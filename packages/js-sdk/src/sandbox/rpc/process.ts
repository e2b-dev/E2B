import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'

import { ProcessService } from '../../envd/process/v1/process_connect'
import {
  ListRequest,
  ListResponse,
  ProcessEvent_EndEvent,
  ProcessEvent_StartEvent,
  ConnectRequest,
  ConnectResponse,
  SendInputRequest,
  StreamInputRequest,
  SendSignalRequest,
  Signal,
  StartRequest,
  StartResponse,
  UpdateRequest,
} from '../../envd/process/v1/process_pb'
import { concatUint8Arrays } from '../array'
import { createDeferredPromise } from '../promise'

// TODO: Sane defaults
// TODO: Reconnect vs connect
// TODO: Add timeout to wait
// TODO: How to handle start + wait
// TODO: Move cwd resolution to envd?
export class Process {
  private readonly service: PromiseClient<typeof ProcessService> = createPromiseClient(ProcessService, this.transport)

  constructor(private readonly transport: Transport) { }

  async list(params: PlainMessage<ListRequest>): Promise<ListResponse['processes']> {
    const res = await this.service.list(params)
    return res.processes
  }

  async start(
    params: PlainMessage<StartRequest>,
    {
      onStderr,
      onStdout,
    }: {
      onStdout?: (data: string) => any,
      onStderr?: (data: string) => any,
    }
  ) {
    const controller = new AbortController()

    const res = this.service.start(params, {
      signal: controller.signal,
    })

    const {
      start,
      wait,
    } = await this.handleProcessStream(res, {
      onStdout,
      onStderr,
    })

    const startEvent = await start

    return {
      pid: startEvent.pid,
      disconnect: () => controller.abort(),
      wait,
      kill: () => this.sendSignal({
        process: {
          selector: {
            case: 'pid',
            value: startEvent.pid,
          }
        },
        signal: Signal.SIGKILL,
      }),
    }
  }

  private async handleProcessStream(
    stream: AsyncIterable<StartResponse | ConnectResponse>,
    {
      onStderr,
      onStdout,
    }: {
      onStdout?: (data: string) => any,
      onStderr?: (data: string) => any,
    }
  ) {
    const start = createDeferredPromise<ProcessEvent_StartEvent>()
    const exit = createDeferredPromise<ProcessEvent_EndEvent>()

    const stdout: Uint8Array[] = []
    const stderr: Uint8Array[] = []

    async function processStream() {
      try {
        for await (const event of stream) {
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
              exit.resolve(event.event.event.value)
              break
          }

        }
      } catch (error) {
        start.reject(error)
        exit.reject(error)
      }
    }

    processStream()

    return {
      start: start.promise,
      wait: async () => {
        const result = await exit.promise
        return {
          ...result,
          get stdout() {
            return concatUint8Arrays(stdout).toString()
          },
          get stderr() {
            return concatUint8Arrays(stderr).toString()
          },
        }
      },
    }
  }

  private async connect(
    params: PlainMessage<ConnectRequest>,
    {
      onStderr,
      onStdout,
    }: {
      onStdout?: (data: string) => any,
      onStderr?: (data: string) => any,
    }
  ) {
    const pid = params.process?.selector.case === 'pid' ? params.process?.selector.value : undefined

    if (pid === undefined) {
      throw new Error('Invalid process PID')
    }

    const controller = new AbortController()

    const res = this.service.connect(params, {
      signal: controller.signal,
    })

    const {
      wait,
    } = await this.handleProcessStream(res, {
      onStdout,
      onStderr,
    })

    return {
      pid,
      disconnect: () => controller.abort(),
      wait,
      kill: () => this.sendSignal({
        process: {
          selector: {
            case: 'pid',
            value: pid,
          }
        },
        signal: Signal.SIGKILL,
      }),
    }
  }

  private async sendSignal(params: PlainMessage<SendSignalRequest>): Promise<void> {
    await this.service.sendSignal(params)
  }

  private async sendInput(params: PlainMessage<SendInputRequest>): Promise<void> {
    await this.service.sendInput(params)
  }

  private async update(params: PlainMessage<UpdateRequest>): Promise<void> {
    await this.service.update(params)
  }

  private async streamInput(params: AsyncIterable<PlainMessage<StreamInputRequest>>) {
    const controller = new AbortController()

    this.service.streamInput(params, {
      signal: controller.signal,
    })

    return {
      stop: () => controller.abort(),
    }
  }
}
