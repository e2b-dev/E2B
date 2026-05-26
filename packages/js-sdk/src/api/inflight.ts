/**
 * Simple FIFO semaphore used to cap the number of in-flight requests sent
 * through a fetch dispatcher. Once `max` requests are outstanding, additional
 * acquires park until an in-flight release.
 */
class Semaphore {
  private active = 0
  private readonly queue: Array<() => void> = []

  constructor(private readonly max: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++
      return () => this.release()
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.active++
        resolve(() => this.release())
      })
    })
  }

  private release() {
    this.active--
    const next = this.queue.shift()
    if (next) next()
  }
}

/**
 * Wrap `fetcher` so at most `max` requests are in-flight at any time.
 * Subsequent requests are FIFO-queued inside the SDK process and dispatched
 * as earlier requests settle.
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
    const release = await sem.acquire()
    try {
      return await fetcher(input, init)
    } finally {
      release()
    }
  }) as typeof fetch
}
