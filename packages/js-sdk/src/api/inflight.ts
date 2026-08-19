import { isRequestLike } from '../is'

/**
 * Simple FIFO semaphore used to cap the number of in-flight requests sent
 * through a fetch dispatcher.
 */
class Semaphore {
  private active = 0
  private readonly queue: Array<() => void> = []

  constructor(private readonly max: number) {}

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw abortReason(signal)
    if (this.active < this.max) {
      this.active++
      return this.slot()
    }

    return new Promise<() => void>((resolve, reject) => {
      const onAcquire = () => {
        signal?.removeEventListener('abort', onAbort)
        this.active++
        resolve(this.slot())
      }
      const onAbort = () => {
        const i = this.queue.indexOf(onAcquire)
        if (i >= 0) this.queue.splice(i, 1)
        reject(abortReason(signal))
      }
      this.queue.push(onAcquire)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  /**
   * A handle that frees the slot it was handed out with, at most once. The
   * body-end tracking below releases from several stream callbacks — cancelling
   * while a pull is in flight settles both paths — and a slot handed back twice
   * would raise the effective cap for every request that follows.
   */
  private slot(): () => void {
    let released = false
    return () => {
      if (released) return
      released = true
      this.release()
    }
  }

  private release() {
    this.active--
    const next = this.queue.shift()
    if (next) next()
  }
}

function abortReason(signal: AbortSignal | undefined): unknown {
  return signal?.reason ?? new DOMException('Aborted', 'AbortError')
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
 * A consumer that neither reads nor cancels a body holds its slot until it is
 * collected — the same thing that happens to the underlying connection.
 */
export function limitConcurrency(
  fetcher: typeof fetch,
  max: number
): typeof fetch {
  if (!Number.isFinite(max) || max <= 0) {
    return fetcher
  }

  const sem = new Semaphore(max)

  return (async (input, init) => {
    // A Request the current global class disowns still carries the signal we
    // have to honor while it waits for a slot, and the method that tells us
    // whether to expect a body.
    const requestLike = isRequestLike(input) ? input : undefined
    const signal = init?.signal ?? requestLike?.signal
    const method = init?.method ?? requestLike?.method ?? 'GET'

    const release = await sem.acquire(signal)
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
