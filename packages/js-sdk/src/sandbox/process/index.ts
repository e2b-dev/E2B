import {
  Code,
  ConnectError,
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'
import { PlainMessage } from '@bufbuild/protobuf'

import { Process as ProcessService } from '../../envd/process/process_connect'
import { Signal, ProcessConfig } from '../../envd/process/process_pb'
import {
  ConnectionConfig,
  Username,
  ConnectionOpts,
  KEEPALIVE_PING_INTERVAL_SEC,
  KEEPALIVE_PING_HEADER,
} from '../../connectionConfig'
import { authenticationHeader, handleRpcError } from '../../envd/rpc'
import { ProcessHandle, ProcessResult } from './processHandle'
import { handleProcessStartEvent } from '../../envd/api'
export { Pty } from './pty'

/**
 * Options for sending a request to a process.
 */
export interface ProcessRequestOpts
  extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> {}

/**
 * Options for starting a new process.
 */
export interface ProcessStartOpts extends ProcessRequestOpts {
  background?: boolean
  cwd?: string
  user?: Username
  envs?: Record<string, string>
  onStdout?: (data: string) => void | Promise<void>
  onStderr?: (data: string) => void | Promise<void>
  timeoutMs?: number
}

/**
 * Options for connecting to a process.
 */
export type ProcessConnectOpts = Pick<
  ProcessStartOpts,
  'onStderr' | 'onStdout' | 'timeoutMs'
> &
  ProcessRequestOpts

/**
 * Process information.
 */
export interface ProcessInfo extends PlainMessage<ProcessConfig> {
  pid: number
  tag?: string
}

/**
 * Manager for starting and interacting with processes in the sandbox.
 */
export class Process {
  protected readonly rpc: PromiseClient<typeof ProcessService>

  private readonly defaultProcessConnectionTimeout = 60_000 // 60 seconds

  constructor(
    transport: Transport,
    private readonly connectionConfig: ConnectionConfig
  ) {
    this.rpc = createPromiseClient(ProcessService, transport)
  }

  /**
   * Lists all running processes.
   *
   * @param opts Options for the request
   * @returns List of running processes
   */
  async list(opts?: ProcessRequestOpts): Promise<ProcessInfo[]> {
    try {
      const res = await this.rpc.list(
        {},
        {
          signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
        }
      )

      return res.processes.map((p) => ({
        pid: p.pid,
        ...(p.tag && { tag: p.tag }),
        args: p.config!.args,
        envs: p.config!.envs,
        cmd: p.config!.cmd,
        ...(p.config!.cwd && { cwd: p.config!.cwd }),
      }))
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  /**
   * Sends data to the stdin of a process
   * .
   * @param pid Process ID to send data to. You can get the list of processes using `sandbox.commands.list()`.
   * @param data Data to send to the process
   * @param opts Options for the request
   */
  async sendStdin(
    pid: number,
    data: string,
    opts?: ProcessRequestOpts
  ): Promise<void> {
    try {
      await this.rpc.sendInput(
        {
          process: {
            selector: {
              case: 'pid',
              value: pid,
            },
          },
          input: {
            input: {
              case: 'stdin',
              value: new TextEncoder().encode(data),
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
   * Kills a process.
   *
   * @param pid Process ID to kill. You can get the list of processes using `sandbox.commands.list()`.
   * @param opts Options for the request
   * @returns `true` if the process was killed, `false` if the process was not found
   */
  async kill(pid: number, opts?: ProcessRequestOpts): Promise<boolean> {
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

  /**
   * Connects to an existing process.
   *
   * @param pid Process ID to connect to. You can get the list of processes using `sandbox.commands.list()`.
   * @param opts Options for connecting to the process
   */
  async connect(
    pid: number,
    opts?: ProcessConnectOpts
  ): Promise<ProcessHandle> {
    const requestTimeoutMs =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = requestTimeoutMs
      ? setTimeout(() => {
          controller.abort()
        }, requestTimeoutMs)
      : undefined

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
        timeoutMs: opts?.timeoutMs ?? this.defaultProcessConnectionTimeout,
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
        opts?.onStdout,
        opts?.onStderr,
        undefined
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  /**
   * Starts a new process without waiting for it to finish.
   * @param cmd Command to execute
   * @param opts Options for starting the process
   * @returns New process
   */
  async run(
    cmd: string,
    opts?: ProcessStartOpts & { background?: false }
  ): Promise<ProcessResult>
  /**
   * Starts a new process and waits until it finishes.
   * @param cmd Command to execute
   * @param opts Options for starting the process
   * @returns New process
   */
  async run(
    cmd: string,
    opts?: ProcessStartOpts & { background: true }
  ): Promise<ProcessHandle>
  async run(
    cmd: string,
    opts?: ProcessStartOpts & { background?: boolean }
  ): Promise<unknown> {
    const proc = await this.start(cmd, opts)

    return opts?.background ? proc : proc.wait()
  }

  /**
   * Use `run` instead.
   * @hidden
   * @hide
   * @internal
   * @access protected
   */
  private async start(
    cmd: string,
    opts?: ProcessStartOpts
  ): Promise<ProcessHandle> {
    const requestTimeoutMs =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = requestTimeoutMs
      ? setTimeout(() => {
          controller.abort()
        }, requestTimeoutMs)
      : undefined

    const events = this.rpc.start(
      {
        process: {
          cmd: '/bin/bash',
          cwd: opts?.cwd,
          envs: opts?.envs,
          args: ['-l', '-c', cmd],
        },
      },
      {
        headers: {
          ...authenticationHeader(opts?.user),
          [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
        },
        signal: controller.signal,
        timeoutMs: opts?.timeoutMs ?? this.defaultProcessConnectionTimeout,
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
        opts?.onStdout,
        opts?.onStderr,
        undefined
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }
}
