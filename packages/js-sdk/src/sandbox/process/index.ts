import { PlainMessage } from '@bufbuild/protobuf'
import {
  createPromiseClient,
  PromiseClient,
  Transport,
} from '@connectrpc/connect'

import { ProcessService } from '../../envd/process/v1/process_connect'
import {
  ProcessConfig as PsProcessConfig,
  Signal,
  StartResponse,
} from '../../envd/process/v1/process_pb'
import { ConnectionOpts } from '../../connectionConfig'
import { ProcessHandle } from './processHandle'

export type ProcessConfig = PlainMessage<PsProcessConfig>

// TODO: How to handle start + wait
// TODO: Move cwd resolution to envd?
// TODO: Enable using process handle as iterable
// TODO: Solve stream input
// TODO: For watch and other stream ensure the timeout throw is handlable
// TODO: Add iterator returns (python too)
// TODO: Passing timeout to envd context via metadata?
// TODO: Does the abort controller work when we specify the request timeout via connect rpc?
export class Process {
  protected readonly rpc: PromiseClient<typeof ProcessService>

  constructor(
    transport: Transport,
    private readonly connectionConfig: ConnectionOpts,
  ) {
    this.rpc = createPromiseClient(ProcessService, transport)
  }

  async list(opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<ProcessConfig[]> {
    const res = await this.rpc.list({}, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
    return res.processes
  }

  async start(
    cmd: string,
    opts: {
      cwd?: string,
      user?: 'root' | 'user',
      envs?: Record<string, string>,
      onStdout?: ((data: string) => void | Promise<void>),
      onStderr?: ((data: string) => void | Promise<void>),
    } & Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<ProcessHandle> {
    const controller = new AbortController()

    const events = this.rpc.start({
      owner: {
        credential: {
          case: 'username',
          value: opts.user || 'user',
        },
      },
      process: {
        cmd: '/bin/bash',
        cwd: opts.cwd,
        envs: opts.envs,
        args: ['-l', '-c', cmd],
      },
    }, {
      signal: controller.signal,
      timeoutMs: opts.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
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
      opts.onStdout,
      opts.onStderr,
    )
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

  async kill(pid: number, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<void> {
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

  async sendStdin(pid: number, data: Uint8Array, opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<void> {
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
          value: data,
        },
      },
    }, {
      timeoutMs: opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs,
    })
  }
}
