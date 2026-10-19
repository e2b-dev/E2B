import type { Client } from '@connectrpc/connect'
import { create } from '@bufbuild/protobuf'

import { KEEPALIVE_PING_INTERVAL_SEC } from '../../connectionConfig'
import {
  Process as ProcessService,
  StreamInputRequestSchema,
} from '../../envd/process/process_pb'
import {
  handleRpcErrorWithHealthCheck,
  SandboxHealthCheck,
} from '../../envd/rpc'
import { SandboxError } from '../../errors'

const CLOSE = Symbol('close')

/**
 * Options for streaming input to a command or PTY.
 */
export interface CommandInputStreamOpts {
  /**
   * Maximum duration of the input stream in milliseconds.
   *
   * @default 60_000
   * `0` disables the timeout.
   */
  timeoutMs?: number
  /**
   * Abort signal for the input stream.
   */
  signal?: AbortSignal
}

type InputKind = 'stdin' | 'pty'
type QueuedInput = string | Uint8Array | typeof CLOSE

/**
 * An ordered, long-lived input stream for a command or PTY.
 */
export class CommandInputStream {
  private readonly queue: QueuedInput[] = []
  private readonly completion: Promise<void>
  private readonly keepaliveIntervalMs: number
  private wake?: () => void
  private closing = false
  private stopped = false
  private failure?: Error
  private closePromise?: Promise<void>

  /**
   * @hidden
   * @internal
   */
  constructor(
    private readonly rpc: Client<typeof ProcessService>,
    private readonly pid: number,
    private readonly inputKind: InputKind,
    opts: CommandInputStreamOpts,
    private readonly checkHealth: SandboxHealthCheck,
    keepaliveIntervalMs = KEEPALIVE_PING_INTERVAL_SEC * 1000
  ) {
    this.keepaliveIntervalMs = keepaliveIntervalMs
    this.completion = this.rpc
      .streamInput(this.requests(), {
        signal: opts.signal,
        timeoutMs: opts.timeoutMs ?? 60_000,
      })
      .then(() => {
        this.stopped = true
        this.notify()
      })
      .catch(async (error: unknown) => {
        this.failure = await handleRpcErrorWithHealthCheck(
          error,
          this.checkHealth
        )
        this.stopped = true
        this.notify()
        throw this.failure
      })
    this.completion.catch(() => undefined)
  }

  /**
   * Enqueue input for transmission in call order.
   *
   * @param data input data to send.
   */
  async send(data: string | Uint8Array): Promise<void> {
    if (this.failure) {
      throw this.failure
    }
    if (this.closing || this.stopped) {
      throw new SandboxError('Cannot send input after the stream is closed.')
    }

    this.queue.push(data)
    this.notify()
  }

  /**
   * Finish the input stream and wait for envd to acknowledge it.
   */
  close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise
    }

    this.closing = true
    this.queue.push(CLOSE)
    this.notify()
    this.closePromise = this.completion
    return this.closePromise
  }

  private notify() {
    this.wake?.()
  }

  private waitForInput(): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        settled = true
        this.wake = undefined
        resolve(false)
      }, this.keepaliveIntervalMs)

      this.wake = () => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        this.wake = undefined
        resolve(true)
      }
    })
  }

  private async *requests() {
    yield create(StreamInputRequestSchema, {
      event: {
        case: 'start',
        value: {
          process: {
            selector: {
              case: 'pid',
              value: this.pid,
            },
          },
        },
      },
    })

    while (!this.stopped) {
      if (this.queue.length > 0) {
        const input = this.queue.shift()!
        if (input === CLOSE) {
          return
        }

        const value =
          typeof input === 'string' ? new TextEncoder().encode(input) : input
        yield create(StreamInputRequestSchema, {
          event: {
            case: 'data',
            value: {
              input: {
                input: {
                  case: this.inputKind,
                  value,
                },
              },
            },
          },
        })
        continue
      }

      const receivedInput = await this.waitForInput()
      if (!receivedInput && !this.stopped && this.queue.length === 0) {
        yield create(StreamInputRequestSchema, {
          event: {
            case: 'keepalive',
            value: {},
          },
        })
      }
    }
  }
}
