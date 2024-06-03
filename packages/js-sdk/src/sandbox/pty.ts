import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'

import { ProcessService } from '../envd/process/process_connect'
import {
  StreamInputRequest,
  Signal,
  StartResponse,
} from '../envd/process/process_pb'
import { ConnectionConfig, ConnectionOpts } from '../connectionConfig'
import { ProcessHandle } from './process/processHandle'

export interface StreamInputHandle {
  stop: () => void
}

export class Pty {
  private readonly service: PromiseClient<typeof ProcessService> = createPromiseClient(ProcessService, this.transport)

  constructor(private readonly transport: Transport, private readonly connectionConfig: ConnectionConfig) { }

  async start({ cols, rows, onData }: {
    cols: number,
    rows: number,
    onData: (data: Uint8Array) => void | Promise<void>,
  }, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<ProcessHandle> {
    const controller = new AbortController()

    const events = this.service.start({
      user: {
        selector: {
          case: 'username',
          value: 'user',
        },
      },
      process: {
        cmd: '/bin/bash',
        args: ['-i', '-l'],
        envs: {
          'TERM': 'xterm',
        },
      },
      pty: {
        size: {
          cols,
          rows,
        },
      },
    }, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
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
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
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
    await this.service.update({
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
      pty: {
        size,
      },
    }, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
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
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
  }
}
