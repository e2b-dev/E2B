import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'

import { Process as ProcessService } from '../../envd/process/process_connect'
import {
  ProcessInfo as PsProcessInfo,
  Signal,
  StartResponse,
} from '../../envd/process/process_pb'
import { ConnectionOpts, defaultUsername, Username } from '../../connectionConfig'
import { ProcessHandle, ProcessOutput } from './processHandle'

export type ProcessInfo = PlainMessage<PsProcessInfo>

export interface ProcessRequestOpts extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> { }

interface ProcessStartOpts extends ProcessRequestOpts {
  background?: boolean
  cwd?: string
  user?: Username
  envs?: Record<string, string>
  onStdout?: ((data: string) => void | Promise<void>)
  onStderr?: ((data: string) => void | Promise<void>)
  timeout?: number
}

export class Process {
  protected readonly rpc: PromiseClient<typeof ProcessService>

  constructor(
    transport: Transport,
    private readonly connectionConfig: ConnectionOpts,
  ) {
    this.rpc = createPromiseClient(ProcessService, transport)
  }

  async list(opts?: ProcessRequestOpts): Promise<ProcessInfo[]> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const res = await this.rpc.list({}, {
      signal: requestTimeoutMs ? AbortSignal.timeout(requestTimeoutMs) : undefined,
    })
    return res.processes
  }

  async kill(pid: number, opts?: ProcessRequestOpts): Promise<void> {
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

  async connect(
    pid: number,
    opts?: {
      onStdout?: ((data: string) => void | Promise<void>),
      onStderr?: ((data: string) => void | Promise<void>),
      timeout?: number,
    } & Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<ProcessHandle> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = setTimeout(() => {
      controller.abort()
    }, requestTimeoutMs)

    const events = this.rpc.connect({
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
    }, {
      signal: controller.signal,
    })

    clearTimeout(reqTimeout)

    const timeout = opts?.timeout ?? requestTimeoutMs

    if (timeout > 0) {
      setTimeout(() => {
        controller.abort()
      }, timeout)
    }

    return new ProcessHandle(
      pid,
      () => controller.abort(),
      () => this.kill(pid),
      events,
      opts?.onStdout,
      opts?.onStderr,
    )
  }

  async run(cmd: string, opts?: ProcessStartOpts & { background?: false }): Promise<ProcessOutput>
  async run(cmd: string, opts?: ProcessStartOpts & { background: true }): Promise<ProcessHandle>
  async run(cmd: string, opts?: ProcessStartOpts & { background?: boolean }): Promise<unknown> {
    const proc = await this.start(cmd, opts)

    return opts?.background
      ? proc
      : proc.wait()
  }

  private async start(
    cmd: string,
    opts?: ProcessStartOpts,
  ): Promise<ProcessHandle> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = setTimeout(() => {
      controller.abort()
    }, requestTimeoutMs)

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
    })

    const startEvent: StartResponse = (await events[Symbol.asyncIterator]().next()).value

    clearTimeout(reqTimeout)

    const timeout = opts?.timeout ?? requestTimeoutMs

    if (timeout > 0) {
      setTimeout(() => {
        controller.abort()
      }, timeout)
    }

    if (startEvent.event?.event.case !== 'start') {
      throw new Error('Expected start event')
    }

    const pid = startEvent.event.event.value.pid

    return new ProcessHandle(
      pid,
      () => controller.abort(),
      () => this.kill(pid),
      events,
      opts?.onStdout,
      opts?.onStderr,
    )
  }
}
