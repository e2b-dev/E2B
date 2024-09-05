import {
  Code,
  ConnectError,
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'

import { Process as ProcessService } from '../envd/process/process_connect'
import {
  Signal,
  StartResponse,
} from '../envd/process/process_pb'
import { ConnectionConfig, ConnectionOpts, Username } from '../connectionConfig'
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
