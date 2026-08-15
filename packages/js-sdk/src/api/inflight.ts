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
      return () => this.release()
    }

    return new Promise<() => void>((resolve, reject) => {
      const onAcquire = () => {
        signal?.removeEventListener('abort', onAbort)
        this.active++
        resolve(() => this.release())
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
 * Wrap a response body so `release` fires exactly once: when the body is
 * fully drained, when reading it errors, or when the consumer cancels it —
 * never on response headers alone. Reconstructing the response this way
 * loses `.url`, `.redirected`, and `.type` (the `Response` constructor has
 * no way to set them, and `Body` methods like `.text()`/`.json()` read an
 * internal body slot rather than the public `.body` getter, so patching
 * just that getter would not intercept them). Nothing in this SDK reads
 * those three properties off a dispatched response, and this wrapper is
 * internal to the fetch pipeline, never part of the public API.
 */
function releaseOnBodyEnd(
  body: ReadableStream<Uint8Array>,
  release: () => void
): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  let released = false
  const releaseOnce = () => {
    if (!released) {
      released = true
      release()
    }
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          releaseOnce()
          controller.close()
          return
        }
        controller.enqueue(value)
      } catch (err) {
        releaseOnce()
        controller.error(err)
      }
    },
    cancel(reason) {
      releaseOnce()
      return reader.cancel(reason)
    },
  })
}

/**
 * Wrap `fetcher` so at most `max` requests are in-flight at any time.
 * Subsequent requests are FIFO-queued inside the SDK process and dispatched
 * as earlier requests settle.
 *
 * The slot stays held until the response body is fully consumed, errors, or
 * is canceled — not just until headers arrive — so the SDK-level cap aligns
 * with the dispatcher's actual connection accounting for streaming
 * responses (logs, command output). A response with no body (e.g. 204/304,
 * HEAD) releases immediately, there is nothing left to hold the slot open
 * for. A caller that never reads the body at all (ignores it entirely)
 * keeps the slot held forever, same as never closing a stream you opened.
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
    // have to honor while it waits for a slot.
    const signal =
      init?.signal ?? (isRequestLike(input) ? input.signal : undefined)
    const release = await sem.acquire(signal)

    let response: Response
    try {
      response = await fetcher(input, init)
    } catch (err) {
      release()
      throw err
    }

    if (response.body === null) {
      release()
      return response
    }

    return new Response(releaseOnBodyEnd(response.body, release), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }) as typeof fetch
}
