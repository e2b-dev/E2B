import {
  Code,
  ConnectError,
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'

import { Process as ProcessService } from '../../envd/process/process_connect'
import { Signal } from '../../envd/process/process_pb'
import {
  ConnectionConfig,
  ConnectionOpts,
  Username,
  KEEPALIVE_PING_HEADER,
  KEEPALIVE_PING_INTERVAL_SEC,
} from '../../connectionConfig'
import { ProcessHandle } from './processHandle'
import { authenticationHeader, handleRpcError } from '../../envd/rpc'
import { handleProcessStartEvent } from '../../envd/api'

export interface PtyCreateOpts
  extends Pick<ConnectionOpts, 'requestTimeoutMs'> {
  cols: number
  rows: number
  onData: (data: Uint8Array) => void | Promise<void>
  timeoutMs?: number
  user?: Username
  envs?: Record<string, string>
  cwd?: string
}

/**
 * Manager for starting and interacting with PTY (pseudo-terminal) processes in the sandbox.
 */
export class Pty {
  private readonly rpc: PromiseClient<typeof ProcessService>

  constructor(
    private readonly transport: Transport,
    private readonly connectionConfig: ConnectionConfig
  ) {
    this.rpc = createPromiseClient(ProcessService, this.transport)
  }

  /**
   * Starts a new process with a PTY (pseudo-terminal).
   *
   * @param opts Options for creating the PTY process
   * @returns New process
   */
  async create(opts: PtyCreateOpts) {
    const requestTimeoutMs =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs
    const envs = opts?.envs ?? {}
    envs.TERM = 'xterm-256color'
    const controller = new AbortController()

    const reqTimeout = setTimeout(() => {
      controller.abort()
    }, requestTimeoutMs)

    const events = this.rpc.start(
      {
        process: {
          cmd: '/bin/bash',
          args: ['-i', '-l'],
          envs: envs,
          cwd: opts?.cwd,
        },
        pty: {
          size: {
            cols: opts.cols,
            rows: opts.rows,
          },
        },
      },
      {
        headers: {
          ...authenticationHeader(opts?.user),
          [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
        },
        signal: controller.signal,
        timeoutMs: opts?.timeoutMs ?? 60_000,
      }
    )

    try {
      const pid = await handleProcessStartEvent(events)

      clearTimeout(reqTimeout)

      return new ProcessHandle(
        pid,
        () => controller.abort(),
        () => this.kill(pid),
        events,
        undefined,
        undefined,
        opts.onData
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  /**
   * Sends input to a PTY process.
   *
   * @param pid Process ID of the PTY process
   * @param data Input data to send
   * @param opts Connection options for the request
   */
  async sendInput(
    pid: number,
    data: Uint8Array,
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<void> {
    try {
      await this.rpc.sendInput(
        {
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
        },
        {
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  /**
   * Resizes a PTY process (changes the number of columns and rows in the terminal).
   *
   * @param pid Process ID of the PTY process
   * @param size New size of the PTY
   * @param opts Connection options for the request
   */
  async resize(
    pid: number,
    size: {
      cols: number
      rows: number
    },
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<void> {
    try {
      await this.rpc.update(
        {
          process: {
            selector: {
              case: 'pid',
              value: pid,
            },
          },
          pty: {
            size,
          },
        },
        {
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  /**
   * Kills a process.
   *
   * @param pid Process ID to kill
   * @param opts Options for the request
   * @returns `true` if the process was killed, `false` if the process was not found
   */
  async kill(
    pid: number,
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<boolean> {
    try {
      await this.rpc.sendSignal(
        {
          process: {
            selector: {
              case: 'pid',
              value: pid,
            },
          },
          signal: Signal.SIGKILL,
        },
        {
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )

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
