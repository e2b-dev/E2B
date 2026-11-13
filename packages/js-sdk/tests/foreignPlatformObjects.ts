/**
 * Stand-ins for web platform objects that were *not* minted by the classes the
 * SDK sees on `globalThis` — what a polyfill (`web-streams-polyfill`,
 * `fetch-blob`), a replaced global (`@hono/node-server`, remix's
 * `installGlobals`), a jsdom-style test environment, or another realm
 * (`node:vm`, `worker_threads`) hands you.
 *
 * `ForeignBlob` and `foreignReadableStream` are separate implementations rather
 * than subclasses on purpose: a subclass still passes `instanceof`, so it would
 * exercise nothing. Requests are the exception — the real-world case is two
 * sibling shim classes (see `foreignRequestClasses`), and a from-scratch
 * `Request` would not be a usable one.
 */

/** A `Blob` from a different `Blob` implementation. */
export class ForeignBlob {
  private readonly bytes: Uint8Array

  constructor(
    parts: string[],
    readonly type = ''
  ) {
    this.bytes = new TextEncoder().encode(parts.join(''))
  }

  get size(): number {
    return this.bytes.byteLength
  }

  get [Symbol.toStringTag](): string {
    return 'Blob'
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.bytes.slice().buffer as ArrayBuffer
  }

  async text(): Promise<string> {
    return new TextDecoder().decode(this.bytes)
  }

  stream(): ReadableStream {
    const bytes = this.bytes
    return foreignReadableStream([bytes])
  }
}

/**
 * A `ReadableStream` from a different stream implementation: readable through
 * the standard reader interface, but not a native stream.
 *
 * By default it is not async-iterable either, like the implementations that
 * predate async iteration — that is the case platform APIs silently stringify
 * to `"[object ReadableStream]"`. Pass `asyncIterable` for the other kind: the
 * platform accepts those as a body, but `pipeThrough` still rejects them.
 */
export function foreignReadableStream(
  chunks: Uint8Array[],
  { asyncIterable = false }: { asyncIterable?: boolean } = {}
): ReadableStream {
  let index = 0
  let cancelled: unknown

  const stream = {
    get [Symbol.toStringTag]() {
      return 'ReadableStream'
    },
    get cancelledWith() {
      return cancelled
    },
    getReader() {
      return {
        async read() {
          return index < chunks.length
            ? { done: false, value: chunks[index++] }
            : { done: true, value: undefined }
        },
        async cancel(reason?: unknown) {
          cancelled = reason
        },
        releaseLock() {},
      }
    },
    tee() {
      return [stream, stream]
    },
    async cancel(reason?: unknown) {
      cancelled = reason
    },
    ...(asyncIterable && {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk
        }
      },
    }),
  }

  return stream as unknown as ReadableStream
}

/**
 * Two sibling `Request` classes, both extending the native one. An instance of
 * either is a fully functional `Request` that the *other* class disowns — which
 * is what `@hono/node-server` and friends produce once a client (openapi-fetch
 * captures `globalThis.Request` when the client is created) outlives a swap of
 * the global.
 */
export function foreignRequestClasses(): {
  MintingRequest: typeof Request
  GlobalShimRequest: typeof Request
} {
  const NativeRequest = globalThis.Request
  class MintingRequest extends NativeRequest {}
  class GlobalShimRequest extends NativeRequest {}
  return { MintingRequest, GlobalShimRequest }
}
