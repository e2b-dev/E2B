import {
  Client,
  Code,
  ConnectError,
  Transport,
  createClient,
} from '@connectrpc/connect'

import { compareVersions } from 'compare-versions'
import {
  ConnectionConfig,
  ConnectionOpts,
  KEEPALIVE_PING_HEADER,
  KEEPALIVE_PING_INTERVAL_SEC,
  Username,
} from '../../connectionConfig'
import { handleProcessStartEvent } from '../../envd/api'
import {
  Process as ProcessService,
  Signal,
} from '../../envd/process/process_pb'
import { authenticationHeader, handleRpcError } from '../../envd/rpc'
import { ENVD_COMMANDS_STDIN } from '../../envd/versions'
import { SandboxError } from '../../errors'
import { CommandHandle, CommandResult } from './commandHandle'
export { Pty } from './pty'

/**
 * Options for sending a command request.
 */
export interface CommandRequestOpts
  extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> {}

/**
 * Options for starting a new command.
 */
export interface CommandStartOpts extends CommandRequestOpts {
  /**
   * If true, starts command in the background and the method returns immediately.
   * You can use {@link CommandHandle.wait} to wait for the command to finish.
   */
  background?: boolean
  /**
   * Working directory for the command.
   *
   * @default // home directory of the user used to start the command
   */
  cwd?: string
  /**
   * User to run the command as.
   *
   * @default `default Sandbox user (as specified in the template)`
   */
  user?: Username
  /**
   * Environment variables used for the command.
   *
   * This overrides the default environment variables from `Sandbox` constructor.
   *
   * @default `{}`
   */
  envs?: Record<string, string>
  /**
   * Callback for command stdout output.
   */
  onStdout?: (data: string) => void | Promise<void>
  /**
   * Callback for command stderr output.
   */
  onStderr?: (data: string) => void | Promise<void>
  /**
   * If true, command stdin is kept open and you can send data to it using {@link Commands.sendStdin} or {@link CommandHandle.sendStdin}.
   * @default false
   */
  stdin?: boolean
  /**
   * Timeout for the command in **milliseconds**.
   *
   * @default 60_000 // 60 seconds
   */
  timeoutMs?: number
}

/**
 * Options for connecting to a command.
 */
export type CommandConnectOpts = Pick<
  CommandStartOpts,
  'onStderr' | 'onStdout' | 'timeoutMs'
> &
  CommandRequestOpts

/**
 * Information about a command, PTY session or start command running in the sandbox as process.
 */
export interface ProcessInfo {
  /**
   * Process ID.
   */
  pid: number
  /**
   * Custom tag used for identifying special commands like start command in the custom template.
   */
  tag?: string
  /**
   * Command that was executed.
   */
  cmd: string
  /**
   * Command arguments.
   */
  args: string[]
  /**
   * Environment variables used for the command.
   */
  envs: Record<string, string>
  /**
   * Executed command working directory.
   */
  cwd?: string
}

/**
 * Module for starting and interacting with commands in the sandbox.
 */
export class Commands {
  protected readonly rpc: Client<typeof ProcessService>

  private readonly defaultProcessConnectionTimeout = 60_000 // 60 seconds
  private readonly envdVersion: string

  constructor(
    transport: Transport,
    private readonly connectionConfig: ConnectionConfig,
    metadata: {
      version: string
    }
  ) {
    this.rpc = createClient(ProcessService, transport)
    this.envdVersion = metadata.version
  }

  /**
   * List all running commands and PTY sessions.
   *
   * @param opts connection options.
   *
   * @returns list of running commands and PTY sessions.
   */
  async list(opts?: CommandRequestOpts): Promise<ProcessInfo[]> {
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
   * Send data to command stdin.
   *
   * @param pid process ID of the command. You can get the list of running commands using {@link Commands.list}.
   * @param data data to send to the command.
   * @param opts connection options.
   */
  async sendStdin(
    pid: number,
    data: string,
    opts?: CommandRequestOpts
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
   * Kill a running command specified by its process ID.
   * It uses `SIGKILL` signal to kill the command.
   *
   * @param pid process ID of the command. You can get the list of running commands using {@link Commands.list}.
   * @param opts connection options.
   *
   * @returns `true` if the command was killed, `false` if the command was not found.
   */
  async kill(pid: number, opts?: CommandRequestOpts): Promise<boolean> {
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
   * Connect to a running command.
   * You can use {@link CommandHandle.wait} to wait for the command to finish and get execution results.
   *
   * @param pid process ID of the command to connect to. You can get the list of running commands using {@link Commands.list}.
   * @param opts connection options.
   *
   * @returns `CommandHandle` handle to interact with the running command.
   */
  async connect(
    pid: number,
    opts?: CommandConnectOpts
  ): Promise<CommandHandle> {
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

      return new CommandHandle(
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
   * Start a new command and wait until it finishes executing.
   *
   * @param cmd command to execute.
   * @param opts options for starting the command.
   *
   * @returns `CommandResult` result of the command execution.
   */
  async run(
    cmd: string,
    opts?: CommandStartOpts & { background?: false }
  ): Promise<CommandResult>

  /**
   * Start a new command in the background.
   * You can use {@link CommandHandle.wait} to wait for the command to finish and get its result.
   *
   * @param cmd command to execute.
   * @param opts options for starting the command
   *
   * @returns `CommandHandle` handle to interact with the running command.
   */
  async run(
    cmd: string,
    opts: CommandStartOpts & { background: true }
  ): Promise<CommandHandle>

  // NOTE - The following overload seems redundant, but it's required to make the type inference work correctly.

  /**
   * Start a new command.
   *
   * @param cmd command to execute.
   * @param opts options for starting the command.
   *   - `opts.background: true` - runs in background, returns `CommandHandle`
   *   - `opts.background: false | undefined` - waits for completion, returns `CommandResult`
   *
   * @returns Either a `CommandHandle` or a `CommandResult` (depending on `opts.background`).
   */
  async run(
    cmd: string,
    opts?: CommandStartOpts & { background?: boolean }
  ): Promise<CommandHandle | CommandResult>
  async run(
    cmd: string,
    opts?: CommandStartOpts & { background?: boolean }
  ): Promise<CommandHandle | CommandResult> {
    const proc = await this.start(cmd, opts)

    return opts?.background ? proc : proc.wait()
  }

  private async start(
    cmd: string,
    opts?: CommandStartOpts
  ): Promise<CommandHandle> {
    const requestTimeoutMs =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const controller = new AbortController()

    const reqTimeout = requestTimeoutMs
      ? setTimeout(() => {
          controller.abort()
        }, requestTimeoutMs)
      : undefined

    if (
      opts?.stdin === false &&
      compareVersions(this.envdVersion, ENVD_COMMANDS_STDIN) < 0
    ) {
      throw new SandboxError(
        `Sandbox envd version ${this.envdVersion} can't specify stdin, it's always turned on. Please rebuild your template if you need this feature.`
      )
    }

    const events = this.rpc.start(
      {
        process: {
          cmd: '/bin/bash',
          cwd: opts?.cwd,
          envs: opts?.envs,
          args: ['-l', '-c', cmd],
        },
        stdin: opts?.stdin || false,
      },
      {
        headers: {
          ...authenticationHeader(this.envdVersion, opts?.user),
          [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
        },
        signal: controller.signal,
        timeoutMs: opts?.timeoutMs ?? this.defaultProcessConnectionTimeout,
      }
    )

    try {
      const pid = await handleProcessStartEvent(events)

      clearTimeout(reqTimeout)

      return new CommandHandle(
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
