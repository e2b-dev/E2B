import type { Interceptor } from '@connectrpc/connect'
import { createTransport } from '@connectrpc/connect/protocol-connect'
import type {
  UniversalClientFn,
  UniversalClientRequest,
  UniversalClientResponse,
} from '@connectrpc/connect/protocol'

function asyncIterableToReadableStream(
  iterable: AsyncIterable<Uint8Array>
): ReadableStream<Uint8Array> {
  const iterator = iterable[Symbol.asyncIterator]()

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next()
        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel(reason) {
      await iterator.return?.(reason)
    },
  })
}

function readableStreamToAsyncIterable(
  stream: ReadableStream<Uint8Array> | null
): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      if (!stream) {
        return
      }

      const reader = stream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            return
          }
          yield value
        }
      } finally {
        reader.releaseLock()
      }
    },
  }
}

function createStreamingHttpClient(
  fetch: typeof globalThis.fetch
): UniversalClientFn {
  return async (
    request: UniversalClientRequest
  ): Promise<UniversalClientResponse> => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.header,
      body: request.body
        ? asyncIterableToReadableStream(request.body)
        : undefined,
      signal: request.signal,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })

    return {
      status: response.status,
      header: response.headers,
      body: readableStreamToAsyncIterable(response.body),
      trailer: new Headers(),
    }
  }
}

export function createClientStreamingTransport({
  baseUrl,
  fetch,
  interceptors = [],
}: {
  baseUrl: string
  fetch: typeof globalThis.fetch
  interceptors?: Interceptor[]
}) {
  return createTransport({
    baseUrl,
    httpClient: createStreamingHttpClient(fetch),
    useBinaryFormat: false,
    interceptors,
    acceptCompression: [],
    sendCompression: null,
    compressMinBytes: 1024,
    readMaxBytes: 0xffffffff,
    writeMaxBytes: 0xffffffff,
  })
}
