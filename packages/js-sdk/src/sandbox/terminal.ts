import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'

import { ProcessService } from '../envd/process/v1/process_connect'
import {
  StreamInputRequest,
  Signal,
  StartRequest,
  StartResponse,
  UpdateRequest,
} from '../envd/process/v1/process_pb'
import { ConnectionOpts } from '../connectionConfig'
import { ProcessHandle } from './process'

export interface StreamInputHandle {
  stop: () => void
}

export class Terminal {
  private readonly service: PromiseClient<typeof ProcessService> = createPromiseClient(ProcessService, this.transport)

  constructor(private readonly transport: Transport) { }

  async start({ cols, rows, onData }: {
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

  async streamInput(params: AsyncIterable<PlainMessage<StreamInputRequest>>, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<StreamInputHandle> {
    const controller = new AbortController()

    this.service.streamInput(params, {
      signal: controller.signal,
      timeoutMs: opts?.requestTimeoutMs,
    })

    return {
      stop: () => controller.abort(),
    }
  }

  async resize(
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
}
