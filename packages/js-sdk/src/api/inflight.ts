/**
 * Simple FIFO semaphore used to cap the number of in-flight requests sent
 * through a fetch dispatcher. Once `max` requests are outstanding, additional
 * acquires park until an in-flight release.
 *
 * `acquire(signal?)` can be cancelled while queued: if `signal` aborts before
 * a slot is granted, the call rejects with the abort reason and the waiter
 * is skipped when the next slot is released. This keeps `requestTimeoutMs`
 * and user-driven cancellation effective even when many requests are queued
 * behind the limiter.
 */
class Semaphore {
  private active = 0
  private readonly queue: Array<QueuedWaiter> = []

  constructor(private readonly max: number) {}

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      throw abortReason(signal)
    }

    if (this.active < this.max) {
      this.active++
      return () => this.release()
    }

    return new Promise<() => void>((resolve, reject) => {
      const waiter: QueuedWaiter = {
        aborted: false,
        resolve: () => {
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(() => this.release())
        },
      }

      const onAbort = () => {
        if (waiter.aborted) return
        waiter.aborted = true
        // Leave the entry in the queue; `release()` will skip aborted
        // waiters so we don't pay an O(n) splice on every cancellation.
        reject(abortReason(signal))
      }

      this.queue.push(waiter)
      if (signal) signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  private release() {
    // Hand the slot off to the next non-aborted waiter without bouncing
    // `active` below `max`. If every queued waiter has been cancelled, the
    // slot is returned to the pool.
    while (this.queue.length > 0) {
      const next = this.queue.shift()!
      if (next.aborted) continue
      next.resolve()
      return
    }
    this.active--
  }
}

type QueuedWaiter = {
  aborted: boolean
  resolve: () => void
}

function abortReason(signal: AbortSignal | undefined): unknown {
  const reason = signal?.reason
  if (reason !== undefined) return reason
  return new DOMException('Aborted', 'AbortError')
}

function extractSignal(
  input: RequestInfo | URL,
  init?: RequestInit
): AbortSignal | undefined {
  if (init?.signal) return init.signal
  if (input instanceof Request) return input.signal
  return undefined
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
    const signal = extractSignal(input, init)
    const release = await sem.acquire(signal)
    try {
      return await fetcher(input, init)
    } finally {
      release()
    }
  }) as typeof fetch
}
