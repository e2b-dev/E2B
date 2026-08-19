import { isRequestLike } from '../is'

export type LimitConcurrencyOptions = {
  /**
   * Name of the env var that configured `max` (e.g. `E2B_ENVD_RPC_INFLIGHT_REQUESTS`).
   * Named in the error when a request is aborted while still queued for a slot,
   * so the failure points at the concurrency cap rather than `requestTimeoutMs`.
   */
  envVarName?: string
  /**
   * Slots that long-lived (Connect streaming) requests cannot occupy, so short
   * unary/control RPCs — `commands.kill`, `sendStdin`, `list`, `pty.kill` —
   * always have headroom on the same semaphore. Clamped so a cap of 1 can still
   * open a stream; in that case unary may use a single overflow slot beyond
   * `max` so teardown is never wedged behind the stream it needs to end.
   */
  reserved?: number
}

type QueuedAcquire = {
  streaming: boolean
  resume: () => void
}

/**
 * Simple FIFO semaphore used to cap the number of in-flight requests sent
 * through a fetch dispatcher. Optional reserved capacity keeps short unary
 * calls runnable while long-lived streaming bodies hold their slots.
 */
class Semaphore {
  private active = 0
  private streamingActive = 0
  private readonly queue: QueuedAcquire[] = []
  private readonly streamingLimit: number
  private readonly unaryLimit: number

  constructor(
    private readonly max: number,
    reserved = 0
  ) {
    // Never reduce the streaming budget below 1 when max >= 1: a reserved
    // equal to max would otherwise make every Connect stream un-startable.
    const effectiveReserved = Math.min(
      Math.max(0, reserved),
      Math.max(0, max - 1)
    )
    this.streamingLimit = max - effectiveReserved
    // When the caller asked for reserved slots but max was too small to carve
    // them out of the pool, allow unary a matching overflow so control RPCs
    // still get through (e.g. max=1, reserved=1 → one stream + one kill).
    this.unaryLimit =
      max + (reserved > effectiveReserved ? reserved - effectiveReserved : 0)
  }

  async acquire(
    signal: AbortSignal | undefined,
    streaming: boolean,
    onAlreadyAborted: () => unknown,
    onQueuedAbort: () => unknown
  ): Promise<() => void> {
    if (signal?.aborted) throw onAlreadyAborted()
    if (this.canAcquire(streaming)) {
      this.admit(streaming)
      return this.slot(streaming)
    }

    return new Promise<() => void>((resolve, reject) => {
      const entry: QueuedAcquire = {
        streaming,
        resume: () => {
          signal?.removeEventListener('abort', onAbort)
          this.admit(streaming)
          resolve(this.slot(streaming))
        },
      }
      const onAbort = () => {
        const i = this.queue.indexOf(entry)
        if (i >= 0) this.queue.splice(i, 1)
        reject(onQueuedAbort())
      }
      this.queue.push(entry)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  private canAcquire(streaming: boolean): boolean {
    if (streaming) {
      return (
        this.active < this.max && this.streamingActive < this.streamingLimit
      )
    }
    return this.active < this.unaryLimit
  }

  private admit(streaming: boolean) {
    this.active++
    if (streaming) this.streamingActive++
  }

  /**
   * A handle that frees the slot it was handed out with, at most once. The
   * body-end tracking below releases from several stream callbacks — cancelling
   * while a pull is in flight settles both paths — and a slot handed back twice
   * would raise the effective cap for every request that follows.
   */
  private slot(streaming: boolean): () => void {
    let released = false
    return () => {
      if (released) return
      released = true
      this.release(streaming)
    }
  }

  private release(streaming: boolean) {
    this.active--
    if (streaming) this.streamingActive--
    this.pump()
  }

  /**
   * Wake the oldest waiter that fits under the limits. Unary waiters are
   * preferred when both kinds are queued: they are the short calls that end
   * streams, and starving them is what reserved capacity exists to prevent.
   */
  private pump() {
    const unaryIdx = this.queue.findIndex((e) => !e.streaming)
    if (unaryIdx >= 0 && this.canAcquire(false)) {
      const [entry] = this.queue.splice(unaryIdx, 1)
      entry.resume()
      return
    }

    const streamingIdx = this.queue.findIndex((e) => e.streaming)
    if (streamingIdx >= 0 && this.canAcquire(true)) {
      const [entry] = this.queue.splice(streamingIdx, 1)
      entry.resume()
    }
  }
}

function defaultAbortReason(signal: AbortSignal | undefined): unknown {
  return signal?.reason ?? new DOMException('Aborted', 'AbortError')
}

/**
 * Reason for a request aborted while it was still waiting for a semaphore
 * slot. Prefer naming the concurrency env var over echoing the caller's
 * `requestTimeoutMs` abort: the request never left the process, so raising
 * the request timeout only makes the hang longer.
 */
function queuedAbortReason(
  signal: AbortSignal | undefined,
  envVarName: string | undefined,
  max: number
): unknown {
  if (!envVarName) return defaultAbortReason(signal)

  return new DOMException(
    `Request was aborted while queued for an in-flight slot under '${envVarName}' ` +
      `(currently ${max}). That cap counts open response bodies — including ` +
      `long-lived streams — not just requests awaiting headers. Raise ` +
      `'${envVarName}', close or cancel open streams, or set it to 0 to disable ` +
      `the cap.`,
    'TimeoutError'
  )
}

/**
 * Connect streaming RPCs advertise themselves with `application/connect+…`
 * Content-Types; unary Connect and every non-Connect request use something
 * else (`application/json`, `application/proto`, …). That is the signal this
 * layer has for "will hold a body open for a long time".
 */
function isConnectStreamingRequest(
  input: RequestInfo | URL,
  init?: RequestInit
): boolean {
  const headers =
    init?.headers ?? (isRequestLike(input) ? input.headers : undefined)
  if (!headers) return false

  const contentType = new Headers(headers).get('content-type')
  return contentType != null && /^application\/connect\+/i.test(contentType)
}

/**
 * The response body a slot has to stay held for, or `null` when the response
 * carries nothing left to read.
 *
 * Distinguishing the two is what keeps the cap from turning into a deadlock:
 * the HTTP clients return these responses to their caller without ever touching
 * the body (`openapi-fetch` short-circuits on the same conditions), so a slot
 * waiting on one of them would never be handed back.
 */
function bodyToTrack(
  response: Response,
  method: string
): ReadableStream<Uint8Array> | null {
  // A null-body status (204/205/304) or an opaque cross-origin response. A body
  // already read or locked by a mock or an interceptor is equally spoken for —
  // we could not read it to its end even if we wanted to.
  if (!response.body || response.bodyUsed || response.body.locked) {
    return null
  }

  // A HEAD response sends no bytes: its `Content-Length` describes the body the
  // same GET would have returned.
  if (method.toUpperCase() === 'HEAD') {
    return null
  }

  // An empty body — the stream exists but EOF is all it will ever yield.
  if (response.headers.get('content-length') === '0') {
    return null
  }

  return response.body
}

/**
 * Pump `body` through a stream that frees the slot once the transfer is over,
 * whichever way it ends: read to EOF, cancelled by the consumer, or errored
 * (a reset stream, an aborted request, a sandbox that went away mid-response).
 */
function releaseOnBodyEnd(
  body: ReadableStream<Uint8Array>,
  release: () => void
): ReadableStream<Uint8Array> {
  const reader = body.getReader()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          release()
          controller.close()
        } else {
          controller.enqueue(value)
        }
      } catch (err) {
        release()
        controller.error(err)
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason)
      } finally {
        release()
      }
    },
  })
}

/**
 * Wrap `fetcher` so at most `max` requests are in-flight at any time.
 * Subsequent requests are FIFO-queued inside the SDK process and dispatched
 * as earlier requests settle.
 *
 * A request counts as in-flight until its response body ends, not until the
 * headers arrive: `fetch` resolves at the headers, while the dispatcher keeps
 * the connection — an HTTP/2 stream — busy for as long as the body is still
 * streaming. Releasing at the headers let a workload of streaming requests
 * (`logs`, command execution, file reads) run far past `max` concurrent
 * connections and exhaust the dispatcher's streams with
 * `ERR_HTTP2_TOO_MANY_CONCURRENT_STREAMS`, which no SDK-level cap could
 * prevent because the cap was counting something else.
 *
 * Waiting for the body means the response has to be re-wrapped, since `fetch`
 * offers no hook for the end of the transfer. The returned response carries the
 * original status and headers over a stream that pumps the original body, and
 * drops only the members no SDK call site reads (`url`, `redirected`, `type`).
 *
 * A body that is neither read nor cancelled never returns its slot: there is
 * no `FinalizationRegistry` here, so abandoning a stream permanently lowers
 * the effective cap for the life of the process. Cancel or fully consume
 * bodies the SDK hands back (`files.read` with `format: 'stream'`, volume
 * reads) when finished with them.
 *
 * When `reserved` is set, Connect streaming requests (`Content-Type:
 * application/connect+…`) are limited to `max - reserved` so unary/control
 * RPCs on the same fetcher can still acquire a slot while streams are open.
 */
export function limitConcurrency(
  fetcher: typeof fetch,
  max: number,
  options: LimitConcurrencyOptions = {}
): typeof fetch {
  if (!Number.isFinite(max) || max <= 0) {
    return fetcher
  }

  const { envVarName, reserved = 0 } = options
  const sem = new Semaphore(max, reserved)

  return (async (input, init) => {
    // A Request the current global class disowns still carries the signal we
    // have to honor while it waits for a slot, and the method that tells us
    // whether to expect a body.
    const requestLike = isRequestLike(input) ? input : undefined
    const signal = init?.signal ?? requestLike?.signal
    const method = init?.method ?? requestLike?.method ?? 'GET'
    const streaming = isConnectStreamingRequest(input, init)

    const release = await sem.acquire(
      signal,
      streaming,
      () => defaultAbortReason(signal),
      () => queuedAbortReason(signal, envVarName, max)
    )
    try {
      const response = await fetcher(input, init)

      const body = bodyToTrack(response, method)
      if (!body) {
        release()
        return response
      }

      return new Response(releaseOnBodyEnd(body, release), {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      })
    } catch (err) {
      release()
      throw err
    }
  }) as typeof fetch
}
