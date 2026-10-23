import type { AnyMessage } from '@agentclientprotocol/sdk'
import {
  CommandExitError,
  SandboxError,
  type CommandHandle,
  type CommandStartOpts,
  type Sandbox,
} from 'e2b'
import {
  DEFAULT_MAX_MESSAGE_BYTES,
  filterAgentMessage,
  LineSplitter,
  PARSE_ERROR_RESPONSE,
  restrictClientCapabilities,
} from './utils'

/**
 * Options for starting an ACP agent in a sandbox.
 */
export interface AcpStartOpts extends Pick<
  CommandStartOpts,
  'cwd' | 'envs' | 'user' | 'requestTimeoutMs' | 'signal'
> {
  /**
   * Callback for the agent's stderr output (logs). The agent's stdout is reserved for the protocol.
   */
  onStderr?: (data: string) => void | Promise<void>
  /**
   * Maximum size of a single message from the agent in **bytes**.
   *
   * @default 33_554_432 // 32 MiB
   */
  maxMessageBytes?: number
}

/**
 * Default time for an ACP agent to exit after `stop()`, in **milliseconds**.
 */
export const DEFAULT_STOP_TIMEOUT_MS = 5_000

/**
 * Options for stopping an ACP agent.
 */
export interface AcpStopOpts {
  /**
   * Time for the agent to exit after `stop()` is called, in **milliseconds**.
   * It covers sending EOF to the agent's stdin; after it the agent is killed.
   *
   * @default DEFAULT_STOP_TIMEOUT_MS // 5 seconds
   */
  timeoutMs?: number
}

/**
 * Exit status of an ACP agent process.
 */
export interface AcpAgentExit {
  /**
   * Exit code of the agent process.
   */
  exitCode: number
  /**
   * Error message if the process failed.
   */
  error?: string
}

/**
 * Message stream connected to an ACP agent.
 */
export interface AcpStream {
  readable: ReadableStream<AnyMessage>
  writable: WritableStream<AnyMessage>
}

/**
 * The part of `Sandbox` the transport needs.
 */
export type AcpSandbox = Pick<Sandbox, 'commands'>

const STDERR_TAIL_CHARS = 4096
const READ_QUEUE_MESSAGES = 64

/**
 * ACP over the stdin/stdout of an agent process in the sandbox.
 */
export class AcpTransport {
  /**
   * @hidden
   * @internal
   */
  constructor(
    readonly pid: number,
    readonly stream: AcpStream,
    private readonly handle: CommandHandle,
    private readonly exit: Promise<AcpAgentExit>,
    private readonly exitStatus: () => AcpAgentExit | undefined,
    private readonly stopReading: () => void,
    private readonly endInput: () => Promise<unknown>
  ) {}

  /**
   * Wait for the agent process to exit.
   *
   * It rejects if the agent's output stream failed before its exit status was known.
   */
  async wait(): Promise<AcpAgentExit> {
    return this.exit
  }

  /**
   * Close the agent: send EOF to its stdin and kill it if it has not exited
   * within `timeoutMs` of this call. Messages the agent sends after this call
   * are not delivered.
   *
   * It rejects if the agent could not be killed.
   */
  async close(opts?: AcpStopOpts): Promise<void> {
    // Only a known exit status means the process is gone. A failed output
    // stream can leave it running.
    if (this.exitStatus()) {
      return
    }

    this.stopReading()
    let timer: ReturnType<typeof setTimeout> | undefined
    const exited = await Promise.race([
      this.endInput()
        .then(() => this.exit)
        .then(
          () => true,
          () => false
        ),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(
          () => resolve(false),
          opts?.timeoutMs ?? DEFAULT_STOP_TIMEOUT_MS
        )
      }),
    ])
    clearTimeout(timer)

    if (!exited && !this.exitStatus()) {
      await this.kill()
    }
  }

  /**
   * Kill the agent process with `SIGKILL`.
   *
   * @returns `true` if the agent was killed, `false` if it was not found.
   */
  async kill(): Promise<boolean> {
    // Output waiting for the client would otherwise keep the handle from
    // seeing the exit.
    this.stopReading()
    return this.handle.kill()
  }
}

/**
 * Start an ACP agent in the sandbox and connect a message stream to its stdin/stdout.
 *
 * The client filesystem and terminal capabilities are turned off in
 * `initialize`, and agent requests for `fs/*` or `terminal/*` are answered
 * with an error without reaching the client, so the agent edits files and
 * runs commands with its own tools in the sandbox.
 */
export async function startAcpTransport(
  sandbox: AcpSandbox,
  cmd: string,
  opts?: AcpStartOpts
): Promise<AcpTransport> {
  const commands = sandbox.commands
  const lines = new LineSplitter(
    opts?.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES
  )
  let stderrTail = ''
  let ended = false
  // Set by close(): the exit that follows is expected, and output after it is
  // not delivered.
  let closing = false
  let resumeReading: (() => void) | undefined
  let controller!: ReadableStreamDefaultController<AnyMessage>
  let exitStatus: AcpAgentExit | undefined

  let resolveHandle!: (handle: CommandHandle) => void
  let rejectHandle!: (err: unknown) => void
  const handleReady = new Promise<CommandHandle>((resolve, reject) => {
    resolveHandle = resolve
    rejectHandle = reject
  })
  handleReady.catch(() => {})

  // Client messages, replies to the agent and EOF share one ordered write
  // path, so concurrent writes never interleave.
  let writes: Promise<void> = Promise.resolve()
  const enqueueWrite = (write: (handle: CommandHandle) => Promise<unknown>) => {
    const result = writes.then(async () => {
      await write(await handleReady)
    })
    writes = result.catch(() => {})
    return result
  }
  const send = (message: unknown) => {
    const line = JSON.stringify(message) + '\n'
    return enqueueWrite((handle) => handle.sendStdin(line))
  }
  const endInput = () =>
    enqueueWrite((handle) =>
      commands.supportsStdinClose ? handle.closeStdin() : handle.kill()
    )

  const end = (err?: unknown) => {
    if (ended) {
      return
    }
    ended = true
    resumeReading?.()
    if (err === undefined) {
      controller.close()
    } else {
      controller.error(err)
    }
  }

  const deliver = async (line: string) => {
    const text = line.trim()
    if (!text || ended || closing) {
      return
    }

    let message: unknown
    try {
      message = JSON.parse(text)
    } catch {
      send(PARSE_ERROR_RESPONSE).catch(() => {})
      return
    }

    const { forward, replies } = filterAgentMessage(message)
    for (const reply of replies) {
      send(reply).catch(() => {})
    }
    if (forward === undefined) {
      return
    }

    controller.enqueue(forward as AnyMessage)
    // Stop reading agent output until the client catches up.
    if ((controller.desiredSize ?? 1) <= 0 && !ended && !closing) {
      await new Promise<void>((resolve) => (resumeReading = resolve))
    }
  }

  let transport: AcpTransport | undefined
  // Output can arrive before startStreaming() returns, so wait for the transport.
  const closeTransport = () => handleReady.then(() => transport!.close())

  const readable = new ReadableStream<AnyMessage>(
    {
      start: (c) => {
        controller = c
      },
      pull: () => {
        resumeReading?.()
        resumeReading = undefined
      },
      cancel: async () => {
        ended = true
        resumeReading?.()
        await closeTransport()
      },
    },
    new CountQueuingStrategy({ highWaterMark: READ_QUEUE_MESSAGES })
  )

  const writable = new WritableStream<AnyMessage>({
    write: (message) => send(restrictClientCapabilities(message)),
    // Closing the writable is a graceful EOF: the agent's remaining messages
    // and a failed exit still reach the client.
    close: () => endInput(),
    abort: () => closeTransport(),
  })

  const stopReading = () => {
    closing = true
    resumeReading?.()
    resumeReading = undefined
  }

  let handle: CommandHandle
  try {
    handle = await commands.startStreaming(cmd, {
      stdin: true,
      timeoutMs: 0,
      cwd: opts?.cwd,
      envs: opts?.envs,
      user: opts?.user,
      requestTimeoutMs: opts?.requestTimeoutMs,
      signal: opts?.signal,
      onStdout: async (data) => {
        if (ended || closing) {
          return
        }
        let complete: string[]
        try {
          complete = lines.push(data)
        } catch (err) {
          end(err)
          // The stream already failed with the real error.
          closeTransport().catch(() => {})
          return
        }
        for (const line of complete) {
          await deliver(line)
        }
      },
      onStderr: async (data) => {
        stderrTail = (stderrTail + data).slice(-STDERR_TAIL_CHARS)
        await opts?.onStderr?.(data)
      },
    })
  } catch (err) {
    rejectHandle(err)
    throw err
  }
  resolveHandle(handle)

  const exit = handle.wait().then(
    (result): AcpAgentExit => ({
      exitCode: result.exitCode,
      error: result.error,
    }),
    (err): AcpAgentExit => {
      if (err instanceof CommandExitError) {
        return { exitCode: err.exitCode, error: err.error }
      }
      throw err
    }
  )

  exit.then(
    async (status) => {
      exitStatus = status
      await deliver(lines.flush())
      if (status.exitCode === 0 || closing) {
        end()
        return
      }
      end(
        new SandboxError(
          `ACP agent exited with code ${status.exitCode}${
            status.error ? `: ${status.error}` : ''
          }${stderrTail ? `\n${stderrTail}` : ''}`
        )
      )
    },
    (err) => {
      end(err)
      // The process may still be running, but nothing can talk to it any
      // more. The stream already failed with the real error.
      stopReading()
      handle.kill().catch(() => {})
    }
  )

  transport = new AcpTransport(
    handle.pid,
    { readable, writable },
    handle,
    exit,
    () => exitStatus,
    stopReading,
    endInput
  )
  return transport
}
