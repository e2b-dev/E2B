import {
  Code,
  ConnectError,
  createClient,
  Client,
  Transport,
} from '@connectrpc/connect'

import {
  Signal,
  Process as ProcessService,
} from '../../envd/process/process_pb'
import {
  ConnectionConfig,
  ConnectionOpts,
  Username,
  KEEPALIVE_PING_HEADER,
  KEEPALIVE_PING_INTERVAL_SEC,
  setupRequestController,
} from '../../connectionConfig'
import { CommandHandle } from './commandHandle'
import { authenticationHeader, handleRpcError } from '../../envd/rpc'
import { handleProcessStartEvent } from '../../envd/api'

export interface PtyCreateOpts
  extends Pick<ConnectionOpts, 'requestTimeoutMs' | 'signal'> {
  /**
   * Number of columns for the PTY.
   */
  cols: number
  /**
   * Number of rows for the PTY.
   */
  rows: number
  /**
   * Callback to handle PTY data.
   */
  onData: (data: Uint8Array) => void | Promise<void>
  /**
   * Timeout for the PTY in **milliseconds**.
   *
   * @default 60_000 // 60 seconds
   */
  timeoutMs?: number
  /**
   * User to use for the PTY.
   *
   * @default `default Sandbox user (as specified in the template)`
   */
  user?: Username
  /**
   * Environment variables for the PTY.
   *
   * @default {}
   */
  envs?: Record<string, string>
  /**
   * Working directory for the PTY.
   *
   * @default // home directory of the user used to start the PTY
   */
  cwd?: string
}

/**
 * Options for connecting to a command.
 */
export type PtyConnectOpts = Pick<PtyCreateOpts, 'onData' | 'timeoutMs'> &
  Pick<ConnectionOpts, 'requestTimeoutMs' | 'signal'>

/**
 * Module for interacting with PTYs (pseudo-terminals) in the sandbox.
 */
export class Pty {
  private readonly rpc: Client<typeof ProcessService>
  private readonly envdVersion: string

  private readonly defaultPtyConnectionTimeout = 60_000 // 60 seconds

  constructor(
    private readonly transport: Transport,
    private readonly connectionConfig: ConnectionConfig,
    metadata: {
      version: string
    }
  ) {
    this.rpc = createClient(ProcessService, this.transport)
    this.envdVersion = metadata.version
  }

  /**
   * Create a new PTY (pseudo-terminal).
   *
   * @param opts options for creating the PTY.
   *
   * @returns handle to interact with the PTY.
   */
  async create(opts: PtyCreateOpts) {
    const requestTimeoutMs =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs
    const envs = opts?.envs ?? {}
    envs.TERM = envs.TERM ?? 'xterm-256color'
    envs.LANG = envs.LANG ?? 'C.UTF-8'
    envs.LC_ALL = envs.LC_ALL ?? 'C.UTF-8'

    const { controller, clearStartTimeout, cleanup } = setupRequestController(
      requestTimeoutMs,
      opts?.signal
    )

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
          ...authenticationHeader(this.envdVersion, opts?.user),
          [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
        },
        signal: controller.signal,
        timeoutMs: opts?.timeoutMs ?? this.defaultPtyConnectionTimeout,
      }
    )

    try {
      const pid = await handleProcessStartEvent(events)
      clearStartTimeout()

      return new CommandHandle(
        pid,
        cleanup,
        () => this.kill(pid),
        events,
        undefined,
        undefined,
        opts.onData
      )
    } catch (err) {
      cleanup()
      throw handleRpcError(err)
    }
  }

  /**
   * Connect to a running PTY.
   *
   * @param pid process ID of the PTY to connect to. You can get the list of running PTYs using {@link Commands.list}.
   * @param opts connection options.
   *
   * @returns handle to interact with the PTY.
   */
  async connect(pid: number, opts?: PtyConnectOpts): Promise<CommandHandle> {
    const requestTimeoutMs =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const { controller, clearStartTimeout, cleanup } = setupRequestController(
      requestTimeoutMs,
      opts?.signal
    )

    const events = this.rpc.connect(
      {
        process: {
          selector: {
            case: 'pid',
            value: pid,
          },
        },
      },
      {
        signal: controller.signal,
        headers: {
          [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
        },
        timeoutMs: opts?.timeoutMs ?? this.defaultPtyConnectionTimeout,
      }
    )

    try {
      const pid = await handleProcessStartEvent(events)
      clearStartTimeout()

      return new CommandHandle(
        pid,
        cleanup,
        () => this.kill(pid),
        events,
        undefined,
        undefined,
        opts?.onData
      )
    } catch (err) {
      cleanup()
      throw handleRpcError(err)
    }
  }

  /**
   * Send input to a PTY.
   *
   * @param pid process ID of the PTY.
   * @param data input data to send to the PTY.
   * @param opts connection options.
   */
  async sendInput(
    pid: number,
    data: Uint8Array,
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs' | 'signal'>
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
          signal: this.connectionConfig.getSignal(
            opts?.requestTimeoutMs,
            opts?.signal
          ),
        }
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  /**
   * Resize PTY.
   * Call this when the terminal window is resized and the number of columns and rows has changed.
   *
   * @param pid process ID of the PTY.
   * @param size new size of the PTY.
   * @param opts connection options.
   */
  async resize(
    pid: number,
    size: {
      cols: number
      rows: number
    },
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs' | 'signal'>
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
          signal: this.connectionConfig.getSignal(
            opts?.requestTimeoutMs,
            opts?.signal
          ),
        }
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  /**
   * Kill a running PTY specified by process ID.
   * It uses `SIGKILL` signal to kill the PTY.
   *
   * @param pid process ID of the PTY.
   * @param opts connection options.
   *
   * @returns `true` if the PTY was killed, `false` if the PTY was not found.
   */
  async kill(
    pid: number,
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs' | 'signal'>
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
          signal: this.connectionConfig.getSignal(
            opts?.requestTimeoutMs,
            opts?.signal
          ),
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
