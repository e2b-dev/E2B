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
}

export type ProcessRunOpts = ProcessStartOpts & {
  background?: false
}

export type ProcessBackgroundRunOpts = ProcessStartOpts & {
  background: true
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
    const res = await this.rpc.list({}, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
    return res.processes
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
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
  }

  async connect(
    pid: number,
    opts?: {
      onStdout?: ((data: string) => void | Promise<void>),
      onStderr?: ((data: string) => void | Promise<void>),
    } & Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<ProcessHandle> {
    const controller = new AbortController()

    const events = this.rpc.connect({
      process: {
        selector: {
          case: 'pid',
          value: pid,
        }
      },
    }, {
      signal: controller.signal,
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })

    return new ProcessHandle(
      pid,
      () => controller.abort(),
      () => this.kill(pid),
      events,
      opts?.onStdout,
      opts?.onStderr,
    )
  }

  async run(
    cmd: string,
    opts?: ProcessRunOpts,
  ): Promise<ProcessOutput>
  async run(
    cmd: string,
    opts?: ProcessBackgroundRunOpts,
  ): Promise<ProcessHandle>
  async run(
    cmd: string,
    opts?: ProcessStartOpts,
  ): Promise<unknown> {
    const proc = await this.start(cmd, opts)

    return opts?.background
      ? proc
      : proc.wait()
  }

  private async start(
    cmd: string,
    opts?: ProcessStartOpts,
  ): Promise<ProcessHandle> {
    const controller = new AbortController()

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
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
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
      opts?.onStdout,
      opts?.onStderr,
    )
  }
}
