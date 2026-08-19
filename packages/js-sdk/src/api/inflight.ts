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
 * Wrap `fetcher` so at most `max` requests are in-flight at any time.
 * Subsequent requests are FIFO-queued inside the SDK process and dispatched
 * as earlier requests settle.
 *
 * A slot is held until the response body ends (fully consumed, cancelled, or
 * errored), not just until the headers arrive, so the SDK-level cap aligns
 * with the dispatcher's connection accounting — a streaming body still
 * occupies an HTTP/2 stream.
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

    return releaseOnBodyEnd(response, release)
  }) as typeof fetch
}

function releaseOnce(release: () => void): () => void {
  let released = false
  return () => {
    if (released) return
    released = true
    release()
  }
}

/**
 * Hold the slot until `response`'s body ends: swap in a passthrough body that
 * releases when the underlying stream is drained, errored, or cancelled.
 * Bodiless responses release immediately.
 */
function releaseOnBodyEnd(response: Response, release: () => void): Response {
  const body = response.body
  if (!body) {
    release()
    return response
  }

  const done = releaseOnce(release)

  // `getReader` rather than piping the stream itself into the new Response:
  // a foreign stream (cross-realm, ponyfill) would fail the platform's brand
  // check, while a native wrapper reading through the reader always passes.
  const reader = body.getReader()
  // The pull loop below cannot observe a source that terminates between
  // pulls (e.g. an abort erroring the stream while a chunk sits in the
  // queue and no read is pending); `closed` settles on any termination.
  void reader.closed.then(done, done)
  const passthrough = new ReadableStream<Uint8Array>({
    async pull(controller) {
      let result: ReadableStreamReadResult<Uint8Array>
      try {
        result = await reader.read()
      } catch (err) {
        done()
        controller.error(err)
        return
      }
      if (result.done) {
        done()
        controller.close()
        return
      }
      controller.enqueue(result.value)
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason)
      } finally {
        done()
      }
    },
  })

  let wrapped: Response
  try {
    wrapped = new Response(passthrough, response)
  } catch {
    // A response the global Response cannot represent (e.g. a ponyfill
    // carrying a body on a null-body status). Give up on body accounting
    // for this response rather than break the request.
    reader.releaseLock()
    done()
    return response
  }

  // The Response constructor only copies status/statusText/headers; carry
  // over the request-derived fields consumers read off a fetch response.
  Object.defineProperties(wrapped, {
    url: { get: () => response.url },
    redirected: { get: () => response.redirected },
    type: { get: () => response.type },
  })

  return wrapped
}
