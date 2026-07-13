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
 * The slot is released when the response body is fully consumed, cancelled,
 * or errors — aligning the SDK-level cap with the dispatcher's connection
 * accounting. Responses with no body (e.g. HEAD) release immediately.
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
    const signal =
      init?.signal ?? (input instanceof Request ? input.signal : undefined)
    const release = await sem.acquire(signal)

    let response: Response
    try {
      response = await fetcher(input, init)
    } catch (e) {
      release()
      throw e
    }

    // No body (e.g. HEAD request) — release the slot immediately.
    if (!response.body) {
      release()
      return response
    }

    // Wrap the response body so the semaphore slot is released when the
    // stream is fully consumed, cancelled, or errors — not when headers
    // arrive. This ensures the concurrency cap accounts for open streaming
    // connections (file downloads, PTY output, command output, etc.).
    let released = false
    const releaseOnce = () => {
      if (!released) {
        released = true
        release()
      }
    }

    const originalBody = response.body
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

    const wrappedBody = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!reader) {
          reader = originalBody.getReader()
        }
        try {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            releaseOnce()
          } else {
            controller.enqueue(value)
          }
        } catch (e) {
          controller.error(e)
          releaseOnce()
        }
      },
      cancel(reason) {
        // Cancel via the reader (which already locked the original body)
        // instead of calling originalBody.cancel() which would throw on a
        // locked stream.
        reader?.cancel(reason)
        releaseOnce()
      },
    })

    return new Response(wrappedBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }) as typeof fetch
}
