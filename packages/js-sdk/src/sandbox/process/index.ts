import {
  Code,
  ConnectError,
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'
import { PlainMessage } from '@bufbuild/protobuf'

import { Process as ProcessService } from '../../envd/process/process_connect'
import {
  Signal,
  ProcessConfig,
} from '../../envd/process/process_pb'
import { ConnectionConfig, Username, ConnectionOpts } from '../../connectionConfig'
import { authenticationHeader, handleRpcError } from '../../envd/rpc'
import { ProcessHandle, ProcessResult } from './processHandle'
import { handleStartEvent } from '../../envd/api'

export interface ProcessRequestOpts extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> { }

export interface ProcessStartOpts extends ProcessRequestOpts {
  background?: boolean
  cwd?: string
  user?: Username
  envs?: Record<string, string>
  onStdout?: ((data: string) => void | Promise<void>)
  onStderr?: ((data: string) => void | Promise<void>)
  timeoutMs?: number
}

export type ProcessConnectOpts = Pick<ProcessStartOpts, 'onStderr' | 'onStdout' | 'timeoutMs'> & ProcessRequestOpts

export interface ProcessInfo extends PlainMessage<ProcessConfig> {
  pid: number
  tag?: string
}

export class Process {
  protected readonly rpc: PromiseClient<typeof ProcessService>

  private readonly defaultProcessConnectionTimeout = 60_000 // 60 seconds

  constructor(
    transport: Transport,
    private readonly connectionConfig: ConnectionConfig,
  ) {
    this.rpc = createPromiseClient(ProcessService, transport)
  }

  async list(opts?: ProcessRequestOpts): Promise<ProcessInfo[]> {
    try {
      const res = await this.rpc.list({}, {
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })

      return res.processes.map((p) => ({
        pid: p.pid,
        ...p.tag && { tag: p.tag },
        args: p.config!.args,
        envs: p.config!.envs,
        cmd: p.config!.cmd,
        ...p.config!.cwd && { cwd: p.config!.cwd },
      }))
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  async sendStdin(pid: number, data: string, opts?: ProcessRequestOpts): Promise<void> {
    try {
      await this.rpc.sendInput({
        process: {
          selector: {
            case: 'pid',
            value: pid,
          }
        },
        input: {
          input: {
            case: 'stdin',
            value: new TextEncoder().encode(data),
          }
        }
      }, {
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  async kill(pid: number, opts?: ProcessRequestOpts): Promise<boolean> {
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

  async connect(pid: number, opts?: ProcessConnectOpts): Promise<ProcessHandle> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = requestTimeoutMs
      ? setTimeout(() => {
        controller.abort()
      }, requestTimeoutMs)
      : undefined

    const events = this.rpc.connect({
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
    }, {
      signal: controller.signal,
      timeoutMs: opts?.timeoutMs ?? this.defaultProcessConnectionTimeout,
    })

    try {
      const pid = await handleStartEvent(events)

      clearTimeout(reqTimeout)

      return new ProcessHandle(
        pid,
        () => controller.abort(),
        () => this.kill(pid),
        events,
        opts?.onStdout,
        opts?.onStderr,
        undefined,
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }

  async run(cmd: string, opts?: ProcessStartOpts & { background?: false }): Promise<ProcessResult>
  async run(cmd: string, opts?: ProcessStartOpts & { background: true }): Promise<ProcessHandle>
  async run(cmd: string, opts?: ProcessStartOpts & { background?: boolean }): Promise<unknown> {
    const proc = await this.start(cmd, opts)

    return opts?.background
      ? proc
      : proc.wait()
  }

  private async start(cmd: string, opts?: ProcessStartOpts): Promise<ProcessHandle> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = requestTimeoutMs
      ? setTimeout(() => {
        controller.abort()
      }, requestTimeoutMs)
      : undefined

    const events = this.rpc.start({
      process: {
        cmd: '/bin/bash',
        cwd: opts?.cwd,
        envs: opts?.envs,
        args: ['-l', '-c', cmd],
      },
    }, {
      headers: authenticationHeader(opts?.user),
      signal: controller.signal,
      timeoutMs: opts?.timeoutMs ?? this.defaultProcessConnectionTimeout,
    })

    try {
      const pid = await handleStartEvent(events)

      clearTimeout(reqTimeout)

      return new ProcessHandle(
        pid,
        () => controller.abort(),
        () => this.kill(pid),
        events,
        opts?.onStdout,
        opts?.onStderr,
        undefined,
      )
    } catch (err) {
      throw handleRpcError(err)
    }
  }
}
