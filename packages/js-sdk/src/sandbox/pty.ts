import {
  Code,
  ConnectError,
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'
import { PartialMessage } from '@bufbuild/protobuf'

import { Process as ProcessService } from '../envd/process/process_connect'
import {
  Signal,
  StartResponse,
  StreamInputRequest,
} from '../envd/process/process_pb'
import { ConnectionConfig, ConnectionOpts, KEEPALIVE_INTERVAL, Username } from '../connectionConfig'
import { ProcessHandle } from './process/processHandle'
import { authenticationHeader, handleRpcError } from '../envd/rpc'

export interface PtyCreateOpts extends Pick<ConnectionOpts, 'requestTimeoutMs'> {
  cols: number
  rows: number
  onData: (data: Uint8Array) => (void | Promise<void>)
  timeout?: number
  user?: Username
}

export class Pty {
  private readonly rpc: PromiseClient<typeof ProcessService>

  constructor(private readonly transport: Transport, private readonly connectionConfig: ConnectionConfig) {
    this.rpc = createPromiseClient(ProcessService, this.transport)
  }

  async create(opts: PtyCreateOpts) {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = setTimeout(() => {
      controller.abort()
    }, requestTimeoutMs)

    const events = this.rpc.start({
      process: {
        cmd: '/bin/bash',
        args: ['-i', '-l'],
        envs: {
          'TERM': 'xterm-256color',
        },
      },
      pty: {
        size: {
          cols: opts.cols,
          rows: opts.rows,
        },
      },
    }, {
      headers: authenticationHeader(opts?.user),
      signal: controller.signal,
      timeoutMs: opts?.timeout ?? 60_000,
    })

    const startEvent: StartResponse = (await events[Symbol.asyncIterator]().next()).value

    if (startEvent.event?.event.case !== 'start') {
      throw new Error('Expected start event')
    }

    clearTimeout(reqTimeout)

    const pid = startEvent.event.event.value.pid

    return new ProcessHandle(
      pid,
      () => controller.abort(),
      () => this.kill(pid),
      events,
      undefined,
      undefined,
      opts.onData,
    )
  }

  async sendInput(pid: number, data: Uint8Array, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<void> {
    try {
      await this.rpc.sendInput({
        input: {
          input: {
            case: 'pty',
            value: data,
          },
        },
        process: {
          selector: {
            case: 'pid',
            value: pid,
          },
        },
      }, {
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  async streamInput(pid: number, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'> & { timeout?: number }) {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = setTimeout(() => {
      controller.abort()
    }, requestTimeoutMs)

    const events = new AsyncQueue<PartialMessage<StreamInputRequest>>()

    this.rpc.streamInput(events, {
      signal: controller.signal,
      timeoutMs: opts?.timeout ?? 60_000,
    })

    clearTimeout(reqTimeout)

    events.enqueue({
      event: {
        case: 'start',
        value: {
          process: {
            selector: {
              case: 'pid',
              value: pid,
            },
          },
        },
      },
    })

    const keepaliveInterval = setInterval(() => {
      events.enqueue({
        event: {
          case: 'keepalive',
          value: {},
        }
      })
    }, KEEPALIVE_INTERVAL)

    return {
      stop: () => {
        controller.abort()
        events.stop()
        clearInterval(keepaliveInterval)
      },
      sendData: (data: Uint8Array) => events.enqueue({
        event: {
          case: 'data',
          value: {
            input: {
              input: {
                case: 'pty',
                value: data,
              },
            },
          },
        },
      }),
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
    await this.rpc.update({
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
      signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
    })
  }

  private async kill(pid: number, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<boolean> {
    try {
      await this.rpc.sendSignal({
        process: {
          selector: {
            case: 'pid',
            value: pid,
          }
        },
        signal: Signal.SIGKILL,
      }, {
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })

      return true
    } catch (err) {
      if (err instanceof ConnectError) {
        if (err.code === Code.NotFound) {
          return false
        }
      }

      throw handleRpcError(err)
    }
  }
}

class AsyncQueue<T> {
  private readonly resolvers: ((value: T) => void)[] = []
  private readonly promises: Promise<T>[] = []

  private stopped = false

  stop() {
    this.stopped = true
  }

  enqueue(t: T) {
    if (!this.resolvers.length) this.add()
    this.resolvers.shift()!(t)
  }

  async *[Symbol.asyncIterator]() {
    while (!this.stopped) {
      const event = await this.dequeue()
      if (event) {
        yield event
      }
    }
  }

  private dequeue() {
    if (!this.promises.length) this.add()
    return this.promises.shift()
  }

  private add() {
    this.promises.push(new Promise(resolve => {
      this.resolvers.push(resolve)
    }))
  }
}
