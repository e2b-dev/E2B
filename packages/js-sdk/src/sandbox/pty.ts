import {
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'

import { Process as ProcessService } from '../envd/process/process_connect'
import {
  Signal,
  StartResponse,
  StreamInputRequest,
} from '../envd/process/process_pb'
import { ConnectionConfig, ConnectionOpts, defaultUsername } from '../connectionConfig'
import { PartialMessage } from '@bufbuild/protobuf'

export interface PtyHandle {
  kill: () => void
  resize: (size: { cols: number, rows: number }) => void
  handleInput: (data: Uint8Array) => Promise<void> | void
}

export class Pty {
  private readonly rpc: PromiseClient<typeof ProcessService> = createPromiseClient(ProcessService, this.transport)

  constructor(private readonly transport: Transport, private readonly connectionConfig: ConnectionConfig) { }

  async create({ cols, rows }: {
    cols: number,
    rows: number,
  }, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'> & { timeout?: number }) {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = setTimeout(() => {
      controller.abort()
    }, requestTimeoutMs)

    const events = this.rpc.start({
      user: {
        selector: {
          case: 'username',
          value: defaultUsername,
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
      signal: controller.signal,
      timeoutMs: opts?.timeout,
    })

    const startEvent: StartResponse = (await events[Symbol.asyncIterator]().next()).value

    if (startEvent.event?.event.case !== 'start') {
      throw new Error('Expected start event')
    }

    clearTimeout(reqTimeout)

    const pid = startEvent.event.event.value.pid

    const input = await this.streamInput(pid, opts)

    const kill = async () => {
      input.stop()
      controller.abort()
      await this.kill(pid)
    }

    return {
      kill,
      resize: (size: { cols: number, rows: number }) => this.resize(pid, size),
      sendInput: (data: Uint8Array) => input.sendData(data),
      output: {
        [Symbol.asyncIterator]() {
          return {
            next: async () => {
              const event = await events[Symbol.asyncIterator]().next()

              const value: StartResponse = event.value

              switch (value.event?.event.case) {
                case 'data':
                  switch (value.event.event.value.output.case) {
                    case 'pty':
                      return {
                        done: false,
                        value: value.event.event.value.output.value,
                      }
                  }
              }

              try {
                await kill()
              } catch (e) {
                console.error('Failed to kill process', e)
              }

              throw new Error('Process exited')
            },
            throw: async (e?: any) => {
              try {
                await kill()
              } catch (e) {
                console.error('Failed to kill process', e)
              }

              throw e
            },
            [Symbol.asyncIterator]() { return this },
          }
        },
      }
    }
  }

  private async streamInput(pid: number, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'> & { timeout?: number }) {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = setTimeout(() => {
      controller.abort()
    }, requestTimeoutMs)

    const events = new AsyncQueue<PartialMessage<StreamInputRequest>>()

    this.rpc.streamInput(events, {
      signal: controller.signal,
      timeoutMs: opts?.timeout,
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

    return {
      stop: () => controller.abort(),
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

  private async resize(
    pid: number,
    size: {
      cols: number,
      rows: number,
    },
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>,
  ): Promise<void> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

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
      signal: requestTimeoutMs ? AbortSignal.timeout(requestTimeoutMs) : undefined,
    })
  }

  private async kill(pid: number, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<void> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    await this.rpc.sendSignal({
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
      signal: Signal.SIGKILL,
    }, {
      signal: requestTimeoutMs ? AbortSignal.timeout(requestTimeoutMs) : undefined,
    })
  }
}

class AsyncQueue<T> {
  private readonly resolvers: ((value: T) => void)[] = []
  private readonly promises: Promise<T>[] = []

  enqueue(t: T) {
    if (!this.resolvers.length) this.add()
    this.resolvers.shift()!(t)
  }

  [Symbol.asyncIterator]() {
    return {
      next: () => this.dequeue()!.then(value => ({ done: false, value })),
      [Symbol.asyncIterator]() { return this },
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
