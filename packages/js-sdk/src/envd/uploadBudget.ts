// Node's HTTP/2 client queues a buffered request body (Blob, FormData, bytes,
// string) in full against the session's memory budget (`maxSessionMemory`,
// 10 MB) and resets whichever stream's response headers arrive while that
// budget is exhausted (ENHANCE_YOUR_CALM). Since undici 8 every envd REST
// request of a process multiplexes over one session, so concurrent uploads
// share one budget — with every read and small write whose response may land
// while it is full. Buffered uploads are admitted here so the bodies in flight
// together stay well under it; a single body above this limit is sent on a
// session of its own instead (see `Filesystem.write`). A stream body is
// written chunk by chunk behind `drain`, so it is never queued whole.
export const ENVD_MAX_INFLIGHT_BODY_BYTES = 6 * 1024 * 1024

const utf8Length = (text: string): number =>
  new TextEncoder().encode(text).byteLength

/**
 * Bytes of a request body Node queues in full, or 0 for a body that is
 * streamed or of unknown size.
 */
export function bodyByteLength(body: unknown): number {
  if (body == null) {
    return 0
  }
  if (typeof body === 'string') {
    return utf8Length(body)
  }
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return body.byteLength
  }
  if (body instanceof Blob) {
    return body.size
  }
  if (body instanceof URLSearchParams) {
    return utf8Length(body.toString())
  }
  if (body instanceof FormData) {
    let total = 0
    body.forEach((value, name) => {
      total +=
        utf8Length(name) +
        (typeof value === 'string' ? utf8Length(value) : value.size)
    })
    return total
  }
  return 0
}

export type BodyBudget = {
  /**
   * Run `fn` once `size` more bytes fit in flight; the bytes are released when
   * the returned promise settles — fetch resolves on response headers, which
   * envd sends after reading the whole body, so Node's queue is empty by then.
   * A request aborted while waiting rejects with its signal's reason.
   */
  run<T>(
    size: number,
    signal: AbortSignal | null | undefined,
    fn: () => Promise<T>
  ): Promise<T>
}

/**
 * Admit requests in order while their bodies fit in `limit` bytes together; a
 * body larger than the limit still goes alone. Sizeless requests pass through.
 */
export function createBodyBudget(limit: number): BodyBudget {
  let inflight = 0
  const waiters: Array<{ size: number; admit: () => void }> = []

  const fits = (size: number) => inflight === 0 || inflight + size <= limit
  const admitWaiting = () => {
    while (waiters.length > 0 && fits(waiters[0].size)) {
      waiters.shift()!.admit()
    }
  }

  const acquire = async (size: number, signal?: AbortSignal | null) => {
    if (signal?.aborted) {
      throw signal.reason
    }
    if (waiters.length === 0 && fits(size)) {
      inflight += size
      return
    }

    await new Promise<void>((resolve, reject) => {
      const waiter = {
        size,
        admit: () => {
          signal?.removeEventListener('abort', onAbort)
          inflight += size
          resolve()
        },
      }
      const onAbort = () => {
        const index = waiters.indexOf(waiter)
        if (index !== -1) {
          waiters.splice(index, 1)
        }
        reject(signal!.reason)
        // The aborted waiter may have been holding smaller ones back.
        admitWaiting()
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      waiters.push(waiter)
    })
  }

  return {
    async run(size, signal, fn) {
      if (size <= 0) {
        return fn()
      }
      await acquire(size, signal)
      try {
        return await fn()
      } finally {
        inflight -= size
        admitWaiting()
      }
    },
  }
}

// One budget per process: envd REST dispatchers are shared across sandboxes,
// and sandboxes behind one authority share HTTP/2 sessions.
export const envdUploadBudget = createBodyBudget(ENVD_MAX_INFLIGHT_BODY_BYTES)
