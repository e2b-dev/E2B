import type { ConnectionConfig } from '../../connectionConfig'

const FILE_UPLOAD_RETRY_BASE_DELAY_MS = 250
const FILE_UPLOAD_RETRY_MAX_DELAY_MS = 4_000
const FILE_UPLOAD_RETRY_JITTER_MS = 250

type FileUploadPolicy = Pick<
  ConnectionConfig,
  'fileUploadRetryAttempts' | 'maxGlobalConcurrentFileUploads'
>

type SemaphoreWaiter = {
  resolve: () => void
  reject: (err: unknown) => void
  signal?: AbortSignal
  onAbort?: () => void
}

function getAbortError(signal: AbortSignal) {
  if (signal.reason !== undefined) return signal.reason

  const err = new Error('The operation was aborted')
  err.name = 'AbortError'
  return err
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw getAbortError(signal)
  }
}

class Semaphore {
  private active = 0
  private readonly waiting: SemaphoreWaiter[] = []

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal)
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  private async acquire(signal?: AbortSignal) {
    if (signal) throwIfAborted(signal)

    if (this.active < this.limit) {
      this.active += 1
      return
    }

    await new Promise<void>((resolve, reject) => {
      const waiter: SemaphoreWaiter = {
        resolve,
        reject,
      }

      if (signal) {
        waiter.signal = signal
        waiter.onAbort = () => {
          const index = this.waiting.indexOf(waiter)
          if (index !== -1) {
            this.waiting.splice(index, 1)
          }
          waiter.reject(getAbortError(signal))
        }
        signal.addEventListener('abort', waiter.onAbort, { once: true })
      }

      this.waiting.push(waiter)
    })
  }

  private release() {
    const next = this.waiting.shift()
    if (next) {
      if (next.signal && next.onAbort) {
        next.signal.removeEventListener('abort', next.onAbort)
      }
      next.resolve()
      return
    }
    this.active -= 1
  }
}

const globalFileUploadSemaphores = new Map<number, Semaphore>()

function getGlobalFileUploadSemaphore(maxUploads: number) {
  let semaphore = globalFileUploadSemaphores.get(maxUploads)
  if (!semaphore) {
    semaphore = new Semaphore(maxUploads)
    globalFileUploadSemaphores.set(maxUploads, semaphore)
  }

  return semaphore
}

function fileUploadRetryDelayMs(attempt: number) {
  return (
    Math.min(
      FILE_UPLOAD_RETRY_MAX_DELAY_MS,
      FILE_UPLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
    ) +
    Math.random() * FILE_UPLOAD_RETRY_JITTER_MS
  )
}

function waitForFileUploadRetry(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(getAbortError(signal))
      return
    }

    const onAbort = () => {
      clearTimeout(timeout)
      reject(getAbortError(signal))
    }
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function combineAbortSignals(signals: AbortSignal[]) {
  if (signals.length === 1) return { signal: signals[0]!, cleanup: () => {} }

  const controller = new AbortController()
  const cleanups: (() => void)[] = []

  const cleanup = () => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  }

  const abortFrom = (signal: AbortSignal) => {
    cleanup()
    controller.abort(signal.reason)
  }

  for (const signal of signals) {
    if (signal.aborted) {
      abortFrom(signal)
      return { signal: controller.signal, cleanup }
    }

    const onAbort = () => abortFrom(signal)
    signal.addEventListener('abort', onAbort, { once: true })
    cleanups.push(() => signal.removeEventListener('abort', onAbort))
  }

  return { signal: controller.signal, cleanup }
}

// Error codes that indicate client-side connection saturation or
// transient transport failure. Retrying under bounded concurrency is safe.
const RETRYABLE_NETWORK_CODES = new Set([
  'EMFILE',
  'ENFILE',
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
  'ENETUNREACH',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
])

function isRetryableFileUploadError(err: unknown) {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return false

  // undici (Node fetch) surfaces network failures as `TypeError: fetch failed`
  // with the underlying network error on `err.cause`. Require a known network
  // code so programmer errors (e.g. `undefined.foo`) aren't retried.
  const cause = (err as Error & { cause?: { code?: string } }).cause
  if (cause?.code && RETRYABLE_NETWORK_CODES.has(cause.code)) {
    return true
  }

  // Some runtimes / libraries surface the code directly on the error.
  const code = (err as Error & { code?: string }).code
  if (code && RETRYABLE_NETWORK_CODES.has(code)) {
    return true
  }

  return (
    err.name === 'FetchError' ||
    err.name === 'ConnectError' ||
    err.name === 'NetworkError'
  )
}

export async function retryFileUpload<T>(
  fn: () => Promise<T>,
  policy: FileUploadPolicy,
  signal: AbortSignal
) {
  const attempts = policy.fileUploadRetryAttempts
  const globalUploads = getGlobalFileUploadSemaphore(
    policy.maxGlobalConcurrentFileUploads
  )

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      throwIfAborted(signal)
      return await globalUploads.run(fn, signal)
    } catch (err) {
      if (attempt >= attempts || !isRetryableFileUploadError(err)) {
        throw err
      }

      await waitForFileUploadRetry(fileUploadRetryDelayMs(attempt), signal)
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new Error('Unexpected file upload retry state')
}

export async function runUploadBatch<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number, signal: AbortSignal) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const results = new Array<R | undefined>(items.length)
  const controller = new AbortController()
  let nextIndex = 0
  let firstError: unknown

  async function worker() {
    while (nextIndex < items.length && !controller.signal.aborted) {
      const index = nextIndex
      nextIndex += 1

      try {
        results[index] = await fn(items[index]!, index, controller.signal)
      } catch (err) {
        if (firstError === undefined) {
          firstError = err
          controller.abort()
        }
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )

  if (firstError !== undefined) {
    throw firstError
  }

  return results as R[]
}
