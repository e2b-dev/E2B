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
 * NOTE: the slot is released as soon as `fetcher` resolves with the response
 * headers, not when the response body is fully consumed. This means the
 * effective concurrency can be higher than `max` while bodies are
 * still streaming.
 *
 * TODO: release on body end (consume/cancel/error) so the
 * SDK-level cap aligns with the dispatcher's connection accounting
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
    let res: Response
    try {
      res = await fetcher(input, init)
    } catch (err) {
      release()
      throw err
    }

    if (!res.body) {
      release()
      return res
    }

    let released = false
    const safeRelease = () => {
      if (!released) {
        released = true
        release()
      }
    }

    return createResponseProxy(res, safeRelease)
  }) as typeof fetch
}

function createResponseProxy(res: Response, safeRelease: () => void): Response {
  const methods = ['arrayBuffer', 'blob', 'formData', 'json', 'text'] as const
  for (const method of methods) {
    const original = (res[method] as any).bind(res)
    ;(res as any)[method] = async (...args: any[]) => {
      try {
        return await original(...args)
      } finally {
        safeRelease()
      }
    }
  }

  if (!res.body) return res

  const createBodyProxy = (stream: any): any => {
    return new Proxy(stream, {
      get(target, prop) {
        if (prop === 'cancel') {
          return async (...args: any[]) => {
            try {
              return await target.cancel(...args)
            } finally {
              safeRelease()
            }
          }
        }
        if (prop === 'pipeTo') {
          return async (...args: any[]) => {
            try {
              return await target.pipeTo(...args)
            } finally {
              safeRelease()
            }
          }
        }
        if (prop === 'pipeThrough') {
          return (...args: any[]) => {
            const newStream = target.pipeThrough(...args)
            return createBodyProxy(newStream)
          }
        }
        if (prop === 'getReader') {
          return function (...args: any[]) {
            const reader = target.getReader(...args)
            const originalRead = reader.read.bind(reader)
            const originalCancel = reader.cancel.bind(reader)

            reader.read = async (...readArgs: any[]) => {
              try {
                const result = await originalRead(...readArgs)
                if (result.done) safeRelease()
                return result
              } catch (err) {
                safeRelease()
                throw err
              }
            }

            reader.cancel = async (reason?: any) => {
              try {
                return await originalCancel(reason)
              } finally {
                safeRelease()
              }
            }
            return reader
          }
        }
        if (prop === Symbol.asyncIterator) {
          if (!target[Symbol.asyncIterator]) return undefined
          return async function* (...args: any[]) {
            try {
              yield* target[Symbol.asyncIterator](...args)
            } finally {
              safeRelease()
            }
          }
        }
        
        const value = Reflect.get(target, prop)
        return typeof value === 'function' ? value.bind(target) : value
      }
    })
  }

  const bodyProxy = createBodyProxy(res.body)

  return new Proxy(res, {
    get(target, prop) {
      if (prop === 'body') return bodyProxy
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}
