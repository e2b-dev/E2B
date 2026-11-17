import type { AnyMessage } from '@agentclientprotocol/sdk'
import type { CommandHandle, CommandRequestOpts } from 'e2b'
import {
  DEFAULT_MAX_MESSAGE_BYTES,
  DEFAULT_STOP_TIMEOUT_MS,
  PARSE_ERROR_RESPONSE,
  READ_QUEUE_MESSAGES,
  STDERR_TAIL_CHARS,
} from './consts'
import { ACPError } from './errors'
import type {
  ACPAgentResult,
  ACPAgentStartOpts,
  ACPAgentStopOpts,
  ACPSandbox,
  ACPStream,
} from './types'
import {
  exitErrorMessage,
  filterAgentMessage,
  LineSplitter,
  restrictClientCapabilities,
  waitForExit,
} from './utils'

/**
 * ACP over the stdin/stdout of an agent process in the sandbox.
 */
export class ACPTransport {
  readonly stream: ACPStream

  private readonly lines: LineSplitter
  private handle?: CommandHandle<undefined>
  private readonly handleReady: Promise<CommandHandle<undefined>>
  private resolveHandle!: (handle: CommandHandle<undefined>) => void
  private rejectHandle!: (err: unknown) => void
  private exit?: Promise<ACPAgentResult>
  private exitStatus?: ACPAgentResult

  private controller!: ReadableStreamDefaultController<AnyMessage>
  private resumeReading?: () => void
  private stderrTail = ''
  private ended = false
  // A message over the limit ends the stream before the agent exits; wait()
  // reports it instead of the exit that follows.
  private outputError?: unknown
  // Set by close(): the exit that follows is expected, and output after it is
  // not delivered.
  private closing = false
  // Client messages, replies to the agent and EOF share one ordered write
  // path, so concurrent writes never interleave.
  private writes: Promise<void> = Promise.resolve()

  /**
   * @hidden
   * @internal
   */
  constructor(
    private readonly commands: ACPSandbox['commands'],
    private readonly opts?: ACPAgentStartOpts
  ) {
    this.lines = new LineSplitter(
      opts?.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES
    )
    this.handleReady = new Promise((resolve, reject) => {
      this.resolveHandle = resolve
      this.rejectHandle = reject
    })
    this.handleReady.catch(() => {})
    this.stream = {
      readable: new ReadableStream<AnyMessage>(
        {
          start: (c) => {
            this.controller = c
          },
          pull: () => {
            this.resumeReading?.()
            this.resumeReading = undefined
          },
          cancel: async () => {
            this.ended = true
            this.resumeReading?.()
            await this.closeWhenStarted()
          },
        },
        new CountQueuingStrategy({ highWaterMark: READ_QUEUE_MESSAGES })
      ),
      writable: new WritableStream<AnyMessage>({
        write: (message) => this.send(restrictClientCapabilities(message)),
        // Closing the writable is a graceful EOF: the agent's remaining
        // messages and a failed exit still reach the client.
        close: () => this.endInput(),
        abort: () => this.closeWhenStarted(),
      }),
    }
  }

  get pid(): number {
    return this.handle!.pid
  }

  /**
   * Wait for the agent process to exit.
   *
   * It rejects if the agent's output stream failed before its exit status was
   * known, for example after a message over `maxMessageBytes`.
   */
  async wait(): Promise<ACPAgentResult> {
    const status = await this.exit!
    if (this.outputError !== undefined) {
      throw this.outputError
    }
    return status
  }

  /**
   * Close the agent: send EOF to its stdin and kill it if it has not exited
   * within `timeoutMs` of this call. Messages the agent sends after this call
   * are not delivered.
   *
   * It rejects if the agent could not be killed.
   */
  async close(opts?: ACPAgentStopOpts): Promise<void> {
    // Only a known exit status means the process is gone. A failed output
    // stream can leave it running.
    if (this.exitStatus) {
      return
    }

    this.stopReading()
    let timer: ReturnType<typeof setTimeout> | undefined
    const exited = await Promise.race([
      this.endInput(opts)
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

    if (!exited && !this.exitStatus) {
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
    return this.handle!.kill()
  }

  /**
   * @hidden
   * @internal
   */
  async run(cmd: string): Promise<void> {
    const opts = this.opts
    let handle: CommandHandle<undefined>
    try {
      handle = await this.commands.run(cmd, {
        background: true,
        retainOutput: false,
        stdin: true,
        timeoutMs: 0,
        cwd: opts?.cwd,
        envs: opts?.envs,
        user: opts?.user,
        requestTimeoutMs: opts?.requestTimeoutMs,
        signal: opts?.signal,
        onStdout: (data) => this.onStdout(data),
        onStderr: (data) => this.onStderr(data),
      })
    } catch (err) {
      this.rejectHandle(err)
      throw err
    }
    this.handle = handle
    this.resolveHandle(handle)

    this.exit = waitForExit(handle)
    this.exit.then(
      (status) => this.onExit(status),
      (err) => this.onExitFailed(err)
    )
  }

  // Output can arrive before run() returns, so wait for the handle.
  private closeWhenStarted() {
    return this.handleReady.then(() => this.close())
  }

  private enqueueWrite(
    write: (handle: CommandHandle<undefined>) => Promise<unknown>
  ) {
    const result = this.writes.then(async () => {
      await write(await this.handleReady)
    })
    this.writes = result.catch(() => {})
    return result
  }

  private send(message: unknown) {
    const line = JSON.stringify(message) + '\n'
    return this.enqueueWrite((handle) => handle.sendStdin(line))
  }

  private endInput(opts?: CommandRequestOpts) {
    return this.enqueueWrite((handle) =>
      this.commands.supportsStdinClose ? handle.closeStdin(opts) : handle.kill()
    )
  }

  private stopReading() {
    this.closing = true
    this.resumeReading?.()
    this.resumeReading = undefined
  }

  private end(err?: unknown) {
    if (this.ended) {
      return
    }
    this.ended = true
    this.resumeReading?.()
    if (err === undefined) {
      this.controller.close()
    } else {
      this.controller.error(err)
    }
  }

  private async deliver(line: string) {
    const text = line.trim()
    if (!text || this.ended || this.closing) {
      return
    }

    let message: unknown
    try {
      message = JSON.parse(text)
    } catch {
      this.send(PARSE_ERROR_RESPONSE).catch(() => {})
      return
    }

    const { forward, replies } = filterAgentMessage(message)
    for (const reply of replies) {
      this.send(reply).catch(() => {})
    }
    if (forward === undefined) {
      return
    }

    this.controller.enqueue(forward as AnyMessage)
    // Stop reading agent output until the client catches up.
    if (
      (this.controller.desiredSize ?? 1) <= 0 &&
      !this.ended &&
      !this.closing
    ) {
      await new Promise<void>((resolve) => (this.resumeReading = resolve))
    }
  }

  private async onStdout(data: string) {
    if (this.ended || this.closing) {
      return
    }
    let complete: string[]
    try {
      complete = this.lines.push(data)
    } catch (err) {
      this.outputError = err
      this.end(err)
      // The stream already failed with the real error.
      this.closeWhenStarted().catch(() => {})
      return
    }
    for (const line of complete) {
      await this.deliver(line)
    }
  }

  private async onStderr(data: string) {
    this.stderrTail = (this.stderrTail + data).slice(-STDERR_TAIL_CHARS)
    await this.opts?.onStderr?.(data)
  }

  private async onExit(status: ACPAgentResult) {
    this.exitStatus = status
    await this.deliver(this.lines.flush())
    if (status.exitCode === 0 || this.closing) {
      this.end()
      return
    }
    this.end(new ACPError(exitErrorMessage(status, this.stderrTail)))
  }

  private onExitFailed(err: unknown) {
    this.end(err)
    // The process may still be running, but nothing can talk to it any
    // more. The stream already failed with the real error.
    this.stopReading()
    this.handle!.kill().catch(() => {})
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
export async function startACPTransport(
  sandbox: ACPSandbox,
  cmd: string,
  opts?: ACPAgentStartOpts
): Promise<ACPTransport> {
  const transport = new ACPTransport(sandbox.commands, opts)
  await transport.run(cmd)
  return transport
}
