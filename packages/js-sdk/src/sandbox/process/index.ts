import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  PromiseClient,
  Transport,
  ConnectError,
} from '@connectrpc/connect'

import { Process as ProcessService } from '../../envd/process/process_connect'
import {
  ProcessInfo as PsProcessInfo,
  Signal,
  StartResponse,
} from '../../envd/process/process_pb'
import { ConnectionConfig, defaultUsername, Username, ConnectionOpts, SandboxError } from '../../connectionConfig'
import { ProcessHandle, ProcessResult } from './processHandle'

export type ProcessInfo = PlainMessage<PsProcessInfo>

export interface ProcessRequestOpts extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> { }

export interface ProcessStartOpts extends ProcessRequestOpts {
  background?: boolean
  cwd?: string
  user?: Username
  envs?: Record<string, string>
  onStdout?: ((data: string) => void | Promise<void>)
  onStderr?: ((data: string) => void | Promise<void>)
  timeout?: number
}

export type ProcessConnectOpts = Pick<ProcessStartOpts, 'onStderr' | 'onStdout' | 'timeout'> & ProcessRequestOpts

export class ProcessError extends SandboxError {
  constructor(message: string, public readonly pid: number) {
    super(message)
    this.name = 'ProcessError'
  }
}

export class Process {
  protected readonly rpc: PromiseClient<typeof ProcessService>

  constructor(
    transport: Transport,
    private readonly connectionConfig: ConnectionConfig,
  ) {
    this.rpc = createPromiseClient(ProcessService, transport)
  }

  async list(opts?: ProcessRequestOpts): Promise<ProcessInfo[]> {
    const res = await this.rpc.list({}, {
      signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
    })

    return res.processes
  }

  async sendStdin(pid: number, data: string, opts?: ProcessRequestOpts): Promise<void> {
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
  }

  async kill(pid: number, opts?: ProcessRequestOpts): Promise<void> {
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
      timeoutMs: opts?.timeout ?? 60_000,
    })

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

    try {
      const events = this.rpc.start({
        user: {
          selector: {
            case: 'username',
            value: opts?.user || defaultUsername,
          },
        },
        process: {
          cmd: '/bin/bash',
          cwd: opts?.cwd,
          envs: opts?.envs,
          args: ['-l', '-c', cmd],
        },
      }, {
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
        opts?.onStdout,
        opts?.onStderr,
        undefined,
      )
    } catch (err) {
      const connectErr = ConnectError.from(err)
      console.log(connectErr)
      throw err
    }
  }
}
