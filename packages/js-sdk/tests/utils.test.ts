import { expect, test, vi } from 'vitest'

import { InvalidArgumentError } from '../src/errors'
import {
  runtime,
  sha256,
  toBlob,
  toDispatchableStream,
  toUploadBody,
} from '../src/utils'
import { ForeignBlob, foreignReadableStream } from './foreignPlatformObjects'

const encode = (text: string) => new TextEncoder().encode(text)

async function readBody(body: BodyInit): Promise<string> {
  return await new Response(body).text()
}

test('sha256 hashes with WebCrypto', async () => {
  expect(await sha256('hello')).toBe(
    'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
  )
})

test('toBlob passes a native Blob through untouched', async () => {
  const blob = new Blob(['hello'])
  expect(await toBlob(blob)).toBe(blob)
})

test('toBlob copies the bytes of a Blob from another Blob class', async () => {
  // Regression: a foreign Blob used to reach the platform unrecognized, which
  // stringified it, so the upload contained the text "[object Blob]".
  const blob = await toBlob(new ForeignBlob(['hello'], 'text/plain'))

  expect(blob).toBeInstanceOf(Blob)
  expect(await blob.text()).toBe('hello')
  // Not an equality check: Bun appends a charset to the media type.
  expect(blob.type).toMatch(/^text\/plain/)
})

test('toBlob converts strings and buffers', async () => {
  expect(await (await toBlob('hello')).text()).toBe('hello')
  const buffer = encode('hello').buffer as ArrayBuffer
  expect(await (await toBlob(buffer)).text()).toBe('hello')
  const view = encode('xxhelloxx').subarray(2, 7)
  expect(await (await toBlob(view)).text()).toBe('hello')
  if (runtime === 'node') {
    expect(await (await toBlob(Buffer.from('hello'))).text()).toBe('hello')
  }
})

test('toUploadBody buffers strings, buffers and Blobs', async () => {
  const blob = new Blob(['hello'])
  expect(await toUploadBody(blob)).toMatchObject({
    body: blob,
    streamed: false,
  })

  const fromString = await toUploadBody('hello')
  expect(fromString.streamed).toBe(false)
  expect(await readBody(fromString.body)).toBe('hello')

  const fromView = await toUploadBody(encode('xxhelloxx').subarray(2, 7))
  expect(fromView.streamed).toBe(false)
  expect(await readBody(fromView.body)).toBe('hello')
})

test('toUploadBody streams a native stream', async () => {
  const { body, streamed } = await toUploadBody(new Blob(['hello']).stream())

  expect(streamed).toBe(true)
  expect(await readBody(body)).toBe('hello')
})

test('toUploadBody streams a stream from another stream implementation', async () => {
  // Regression: a foreign stream failed the brand check, so it was buffered
  // into memory instead of streamed — and, once detected, it still has to be
  // adopted, or the platform stringifies it to "[object ReadableStream]".
  const { body, streamed } = await toUploadBody(
    foreignReadableStream([encode('hel'), encode('lo')])
  )

  expect(streamed).toBe(true)
  if (streamed) {
    expect(body).toBeInstanceOf(ReadableStream)
  }
  expect(await readBody(body)).toBe('hello')
})

test('an adopted foreign stream forwards cancellation to its source', async () => {
  const stream = foreignReadableStream([encode('hello')])
  const { body } = await toUploadBody(stream)

  await (body as ReadableStream).cancel('aborted upload')

  expect((stream as unknown as { cancelledWith: unknown }).cancelledWith).toBe(
    'aborted upload'
  )
})

test('toUploadBody leaves an async-iterable foreign stream alone', async () => {
  // Outside the browser the platform accepts any async iterable as a body, so
  // adopting one would only add a layer. Browser fetch takes only its own
  // stream class.
  const stream = foreignReadableStream([encode('hel'), encode('lo')], {
    asyncIterable: true,
  })
  const { body, streamed } = await toUploadBody(stream)

  expect(streamed).toBe(true)
  if (runtime !== 'browser') {
    expect(body).toBe(stream)
  }
  expect(await readBody(body)).toBe('hello')
})

test('toUploadBody does not re-wrap a native stream when the global class was replaced', async () => {
  // A polyfilled `globalThis.ReadableStream` used to make the adoption step
  // wrap a perfectly good native stream into a polyfill instance the platform
  // then stringifies — worse than doing nothing.
  const nativeStream = new Blob(['hello']).stream()
  class PolyfillStream {
    getReader() {}
    tee() {}
    cancel() {}
  }

  vi.stubGlobal('ReadableStream', PolyfillStream)
  let body: BodyInit
  let streamed: boolean
  try {
    expect(nativeStream instanceof globalThis.ReadableStream).toBe(false)
    ;({ body, streamed } = await toUploadBody(nativeStream))
  } finally {
    vi.unstubAllGlobals()
  }

  expect(streamed).toBe(true)
  if (streamed) {
    expect(body).toBe(nativeStream)
  }
  expect(await readBody(body)).toBe('hello')
})

test('toUploadBody copies the bytes of a Blob from another Blob class', async () => {
  const { body, streamed } = await toUploadBody(new ForeignBlob(['hello']))

  expect(streamed).toBe(false)
  expect(body).toBeInstanceOf(Blob)
  expect(await readBody(body)).toBe('hello')
})

test.each([
  ['native stream', () => new Blob(['hello']).stream()],
  [
    'foreign stream',
    () => foreignReadableStream([encode('hel'), encode('lo')]),
  ],
  [
    'async-iterable foreign stream',
    () =>
      foreignReadableStream([encode('hel'), encode('lo')], {
        asyncIterable: true,
      }),
  ],
  ['foreign Blob', () => new ForeignBlob(['hello'])],
  ['string', () => 'hello'],
  ['Uint8Array subarray', () => encode('xxhelloxx').subarray(2, 7)],
  ...(runtime === 'node'
    ? [['Node.js Buffer', () => Buffer.from('hello')] as const]
    : []),
])('toUploadBody gzips a %s', async (_name, makeData) => {
  // Regression: piping a foreign stream through a native CompressionStream
  // never settles, so gzip uploads hung for anything but a native stream.
  // Unlike a body, `pipeThrough` is not satisfied by async iterability, so
  // every foreign stream has to be adopted here.
  const data = makeData()
  const { body, streamed } = await toUploadBody(data, true)

  // In-memory data is gzipped into a Blob in browsers; streams always stream.
  const inMemory =
    typeof data === 'string' ||
    data instanceof ForeignBlob ||
    data instanceof Uint8Array
  expect(streamed).toBe(!inMemory || runtime !== 'browser')
  const compressed = streamed
    ? (body as ReadableStream)
    : (body as Blob).stream()
  const text = await readBody(
    compressed.pipeThrough(new DecompressionStream('gzip'))
  )
  expect(text).toBe('hello')
})

async function* asyncChunks(...chunks: string[]) {
  for (const chunk of chunks) {
    yield encode(chunk)
  }
}

test('toUploadBody streams an async iterable', async () => {
  const { body, streamed } = await toUploadBody(asyncChunks('hel', 'lo'))

  expect(streamed).toBe(true)
  if (streamed) {
    expect(body).toBeInstanceOf(ReadableStream)
  }
  expect(await readBody(body)).toBe('hello')
})

test('toUploadBody gzips an async iterable', async () => {
  const { body, streamed } = await toUploadBody(asyncChunks('hel', 'lo'), true)

  expect(streamed).toBe(true)
  const compressed = streamed
    ? (body as ReadableStream)
    : (body as Blob).stream()
  expect(
    await readBody(compressed.pipeThrough(new DecompressionStream('gzip')))
  ).toBe('hello')
})

test('async iterable data rejects non-byte chunks', async () => {
  async function* strings() {
    yield 'hello'
  }
  const data = strings() as unknown as AsyncIterable<Uint8Array>

  const { body, sourceError } = await toUploadBody(data)
  // Browsers report their own error when reading the body fails.
  await expect(readBody(body)).rejects.toThrow()
  expect(sourceError()).toBeInstanceOf(InvalidArgumentError)
  expect(String(sourceError())).toContain(
    'AsyncIterable upload data must yield Uint8Array chunks, got string'
  )
})

test.skipIf(runtime !== 'node')(
  'async iterable data accepts cross-realm Uint8Array chunks',
  async () => {
    const { runInNewContext } = await import('node:vm')
    const foreign = runInNewContext('new Uint8Array([104, 105])') as Uint8Array
    async function* chunks() {
      yield foreign
    }

    const { body } = await toUploadBody(chunks())
    expect(await readBody(body)).toBe('hi')
  }
)

test('streamed async iterable is closed on an invalid chunk', async () => {
  let closed = false
  async function* strings() {
    try {
      yield 'hello'
    } finally {
      closed = true
    }
  }

  const { body } = await toUploadBody(strings() as never)
  await expect(readBody(body)).rejects.toThrow()
  expect(closed).toBe(true)
})

test('streamed async iterable copies reused chunks', async () => {
  async function* reused() {
    const buf = new Uint8Array(1)
    buf[0] = 97
    yield buf
    buf[0] = 98
    yield buf
  }

  const { body } = await toUploadBody(reused())
  expect(await readBody(body)).toBe('ab')
})

test.skipIf(runtime !== 'browser')(
  'stream data throws instead of buffering where the browser cannot stream it',
  async () => {
    // A browser without streaming request bodies stringifies the stream.
    class NoStreamsRequest {
      headers = new Headers({ 'Content-Type': 'text/plain;charset=UTF-8' })
    }
    vi.stubGlobal('Request', NoStreamsRequest)
    try {
      await expect(toUploadBody(asyncChunks('hello'))).rejects.toThrow(
        /pass the data as a `Blob`/i
      )
      await expect(toUploadBody(new Blob(['hello']).stream())).rejects.toThrow(
        InvalidArgumentError
      )
      expect((await toUploadBody('hello')).streamed).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  }
)

test('toDispatchableStream works when the global Blob has no stream()', () => {
  const NativeStream = ReadableStream
  // jsdom-style environments replace the global Blob with one lacking stream().
  vi.stubGlobal('Blob', class StreamlessBlob {})
  try {
    const stream = new NativeStream()
    expect(toDispatchableStream(stream)).toBe(stream)
  } finally {
    vi.unstubAllGlobals()
  }
})
