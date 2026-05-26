/**
 * Simple FIFO semaphore used to cap the number of in-flight requests sent
 * through a fetch dispatcher. Once `max` requests are outstanding, additional
 * acquires park until an in-flight release.
 *
 * `acquire(signal?)` rejects if `signal` is or becomes aborted, so queued
 * requests can be cancelled by `requestTimeoutMs` or user code without
 * waiting for an earlier in-flight request to finish.
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
 * Honors the caller's abort signal while queued: if `init.signal` (or the
 * `Request`'s signal) aborts before a slot is acquired, the wrapped fetch
 * rejects immediately with the abort reason instead of blocking behind
 * earlier requests.
 *
 * Useful for capping bursts (e.g., 20k concurrent `Sandbox.create` calls)
 * so they don't queue inside undici/h2/load balancer.
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
    try {
      return await fetcher(input, init)
    } finally {
      release()
    }
  }) as typeof fetch
}
