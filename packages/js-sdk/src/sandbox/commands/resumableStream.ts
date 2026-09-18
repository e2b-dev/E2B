import { Client, Code, ConnectError } from '@connectrpc/connect'

import {
  KEEPALIVE_PING_HEADER,
  KEEPALIVE_PING_INTERVAL_SEC,
  setupRequestController,
} from '../../connectionConfig'
import {
  ConnectResponse,
  OutputOffsets,
  Process as ProcessService,
  StartResponse,
} from '../../envd/process/process_pb'
import { isConnectionTerminatedError, SandboxHealthCheck } from '../../envd/rpc'
import { SandboxError } from '../../errors'

/**
 * Byte position in each output stream of a process, counted from its start.
 */
export interface OutputPosition {
  stdout: bigint
  stderr: bigint
  pty: bigint
}

/**
 * Error thrown when the connection to a command was re-established but the
 * sandbox no longer retains the output produced while it was down.
 *
 * The command itself keeps running; use {@link Commands.connect} to follow its
 * output from the current position.
 */
export class CommandOutputLostError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'CommandOutputLostError'
  }
}

/**
 * Opens a Connect stream for the process that replays retained output from
 * `resumeFrom` before continuing live.
 */
export type ConnectFromOffsets = (
  resumeFrom: OutputPosition,
  signal: AbortSignal,
  timeoutMs: number
) => AsyncIterable<ConnectResponse>

export function connectProcessFrom(
  rpc: Client<typeof ProcessService>,
  pid: number
): ConnectFromOffsets {
  return (resumeFrom, signal, timeoutMs) =>
    rpc.connect(
      {
        process: {
          selector: {
            case: 'pid',
            value: pid,
          },
        },
        resumeFrom,
      },
      {
        signal,
        headers: {
          [KEEPALIVE_PING_HEADER]: KEEPALIVE_PING_INTERVAL_SEC.toString(),
        },
        timeoutMs,
      }
    )
}

export interface ResumableStreamOpts {
  /**
   * Stream whose start event has already been consumed.
   */
  events: AsyncIterable<ConnectResponse | StartResponse>
  /**
   * Position at which `events` begins, as announced by its start event.
   * `undefined` when the sandbox cannot resume streams, in which case a
   * dropped connection is surfaced as before.
   */
  offsets?: OutputOffsets
  /**
   * Aborts `events` and releases its timers.
   */
  cleanup: () => void
  connect: ConnectFromOffsets
  requestTimeoutMs?: number
  signal?: AbortSignal
  /**
   * Total time the stream may stay open across reconnects, in milliseconds.
   * `0` disables the limit.
   */
  timeoutMs: number
  checkHealth?: SandboxHealthCheck
  /**
   * Consecutive failed reconnect attempts after which the original error is
   * surfaced.
   */
  maxAttempts?: number
  /**
   * Delay before the first reconnect attempt; doubles on each retry.
   */
  backoffMs?: number
}

export const DEFAULT_RESUME_ATTEMPTS = 5
export const DEFAULT_RESUME_BACKOFF_MS = 250
const MAX_RESUME_BACKOFF_MS = 5_000

/**
 * Whether an error from a process event stream is a dropped connection that is
 * worth re-establishing, as opposed to a deliberate cancellation, a deadline,
 * or an error the sandbox returned on purpose.
 */
export function isTransientStreamError(err: unknown): boolean {
  if (isConnectionTerminatedError(err)) {
    return true
  }

  if (err instanceof ConnectError) {
    return err.code === Code.Unavailable
  }

  return false
}

/**
 * Process event stream that survives dropped connections.
 *
 * It tracks the position in each output stream that the consumer has been
 * handed. When the connection drops, it reconnects with those positions as
 * `resume_from`, so the sandbox replays what was produced in the meantime and
 * the consumer sees an unbroken sequence of events without duplicates. The
 * start event of a reconnected stream is consumed here; only data and end
 * events reach the consumer.
 */
export class ResumableProcessStream implements AsyncIterable<
  ConnectResponse | StartResponse
> {
  private readonly position: OutputPosition
  private readonly deadline?: number
  private readonly maxAttempts: number
  private readonly backoffMs: number

  private cleanup: () => void
  private stopped = false
  private wakeBackoff?: () => void

  constructor(private readonly opts: ResumableStreamOpts) {
    this.cleanup = opts.cleanup
    this.position = {
      stdout: opts.offsets?.stdout ?? 0n,
      stderr: opts.offsets?.stderr ?? 0n,
      pty: opts.offsets?.pty ?? 0n,
    }
    this.deadline = opts.timeoutMs ? Date.now() + opts.timeoutMs : undefined
    this.maxAttempts = opts.maxAttempts ?? DEFAULT_RESUME_ATTEMPTS
    this.backoffMs = opts.backoffMs ?? DEFAULT_RESUME_BACKOFF_MS
  }

  /**
   * Whether the sandbox retains output for this stream, so a dropped
   * connection can be resumed.
   */
  get resumable(): boolean {
    return this.opts.offsets !== undefined
  }

  /**
   * Position in each output stream up to which events have been handed out.
   */
  get consumed(): Readonly<OutputPosition> {
    return this.position
  }

  /**
   * Aborts the current connection and stops any pending reconnect.
   */
  disconnect() {
    this.stopped = true
    this.cleanup()
    this.wakeBackoff?.()
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<
    ConnectResponse | StartResponse
  > {
    let source = this.opts.events

    for (;;) {
      try {
        for await (const event of source) {
          this.advance(event)
          yield event
        }
        return
      } catch (err) {
        if (this.stopped || !this.resumable || !isTransientStreamError(err)) {
          throw err
        }

        this.cleanup()
        source = await this.reconnect(err)
      }
    }
  }

  private advance(event: ConnectResponse | StartResponse) {
    const e = event.event?.event
    if (e?.case !== 'data') {
      return
    }

    const output = e.value.output
    if (output.case === undefined) {
      return
    }

    const start = e.value.offset ?? this.position[output.case]
    this.position[output.case] = start + BigInt(output.value.byteLength)
  }

  private async reconnect(
    cause: unknown
  ): Promise<AsyncIterable<ConnectResponse>> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      await this.backoff(attempt)
      if (this.stopped) {
        throw cause
      }

      const remainingMs = this.remainingMs()
      if (remainingMs !== undefined && remainingMs <= 0) {
        throw new ConnectError(
          'Process stream deadline exceeded while reconnecting',
          Code.DeadlineExceeded
        )
      }

      const running = await this.opts.checkHealth?.().catch(() => undefined)
      if (running === false) {
        throw cause
      }

      const { controller, clearStartTimeout, cleanup } = setupRequestController(
        this.opts.requestTimeoutMs,
        this.opts.signal
      )
      this.cleanup = cleanup

      const events = this.opts.connect(
        { ...this.position },
        controller.signal,
        remainingMs ?? 0
      )

      try {
        await readStartEvent(events)
        clearStartTimeout()
        return events
      } catch (err) {
        cleanup()

        if (this.stopped) {
          throw cause
        }
        if (isTransientStreamError(err)) {
          cause = err
          continue
        }
        if (err instanceof ConnectError && err.code === Code.OutOfRange) {
          throw new CommandOutputLostError(
            `${err.rawMessage}: The connection to the command was re-established, but the sandbox no longer retains the output produced while it was down. The command is still running; use 'commands.connect' to follow its output from now on.`
          )
        }
        throw err
      }
    }

    throw cause
  }

  private remainingMs(): number | undefined {
    if (this.deadline === undefined) {
      return undefined
    }
    return this.deadline - Date.now()
  }

  private backoff(attempt: number): Promise<void> {
    const delayMs = Math.min(
      this.backoffMs * 2 ** attempt,
      MAX_RESUME_BACKOFF_MS
    )

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wakeBackoff = undefined
        resolve()
      }, delayMs)
      this.wakeBackoff = () => {
        clearTimeout(timer)
        this.wakeBackoff = undefined
        resolve()
      }
    })
  }
}

async function readStartEvent(events: AsyncIterable<ConnectResponse>) {
  const first = await events[Symbol.asyncIterator]().next()
  if (first.done || first.value.event?.event.case !== 'start') {
    throw new SandboxError('Expected start event when resuming the stream')
  }
}
