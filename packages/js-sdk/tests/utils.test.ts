import { expect, test, vi } from 'vitest'

import {
  parseRetryAfter,
  runtime,
  sha256,
  toBlob,
  toUploadBody,
} from '../src/utils'
import { ForeignBlob, foreignReadableStream } from './foreignPlatformObjects'

const encode = (text: string) => new TextEncoder().encode(text)

// Browsers can't stream request bodies, so everything is buffered there.
const streams = runtime !== 'browser'

async function readBody(body: BodyInit): Promise<string> {
  return await new Response(body).text()
}

test('parseRetryAfter parses delta-seconds', () => {
  expect(parseRetryAfter('120')).toBe(120)
})

test('parseRetryAfter trims surrounding whitespace', () => {
  expect(parseRetryAfter(' 120 ')).toBe(120)
})

test('parseRetryAfter parses an HTTP-date', () => {
  const retryAt = new Date(Date.now() + 60_000)
  const parsed = parseRetryAfter(retryAt.toUTCString())
  expect(parsed).toBeGreaterThanOrEqual(55)
  expect(parsed).toBeLessThanOrEqual(60)
})

test('parseRetryAfter rejects negative delta-seconds', () => {
  expect(parseRetryAfter('-1')).toBeUndefined()
})

test('parseRetryAfter rejects garbage', () => {
  expect(parseRetryAfter('not a valid value')).toBeUndefined()
})

test('parseRetryAfter returns undefined for a missing header', () => {
  expect(parseRetryAfter(null)).toBeUndefined()
  expect(parseRetryAfter(undefined)).toBeUndefined()
  expect(parseRetryAfter('')).toBeUndefined()
})

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

test('toBlob reads a stream from another stream implementation', async () => {
  const blob = await toBlob(
    foreignReadableStream([encode('hel'), encode('lo')])
  )

  expect(await blob.text()).toBe('hello')
})

test('toBlob converts strings and buffers', async () => {
  expect(await (await toBlob('hello')).text()).toBe('hello')
  const buffer = encode('hello').buffer as ArrayBuffer
  expect(await (await toBlob(buffer)).text()).toBe('hello')
})

test('toUploadBody buffers strings, buffers and Blobs', async () => {
  const blob = new Blob(['hello'])
  expect(await toUploadBody(blob)).toEqual({ body: blob, streamed: false })

  const fromString = await toUploadBody('hello')
  expect(fromString.streamed).toBe(false)
  expect(await readBody(fromString.body)).toBe('hello')
})

test('toUploadBody streams a native stream', async () => {
  const { body, streamed } = await toUploadBody(new Blob(['hello']).stream())

  expect(streamed).toBe(streams)
  expect(await readBody(body)).toBe('hello')
})

test('toUploadBody streams a stream from another stream implementation', async () => {
  // Regression: a foreign stream failed the brand check, so it was buffered
  // into memory instead of streamed — and, once detected, it still has to be
  // adopted, or the platform stringifies it to "[object ReadableStream]".
  const { body, streamed } = await toUploadBody(
    foreignReadableStream([encode('hel'), encode('lo')])
  )

  expect(streamed).toBe(streams)
  if (streamed) {
    expect(body).toBeInstanceOf(ReadableStream)
  }
  expect(await readBody(body)).toBe('hello')
})

test.skipIf(!streams)(
  'an adopted foreign stream forwards cancellation to its source',
  async () => {
    const stream = foreignReadableStream([encode('hello')])
    const { body } = await toUploadBody(stream)

    await (body as ReadableStream).cancel('aborted upload')

    expect(
      (stream as unknown as { cancelledWith: unknown }).cancelledWith
    ).toBe('aborted upload')
  }
)

test('toUploadBody leaves an async-iterable foreign stream alone', async () => {
  // The platform accepts any async iterable as a body, so adopting one would
  // only add a layer.
  const stream = foreignReadableStream([encode('hel'), encode('lo')], {
    asyncIterable: true,
  })
  const { body, streamed } = await toUploadBody(stream)

  expect(streamed).toBe(streams)
  if (streamed) {
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

  expect(streamed).toBe(streams)
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
])('toUploadBody gzips a %s', async (_name, makeData) => {
  // Regression: piping a foreign stream through a native CompressionStream
  // never settles, so gzip uploads hung for anything but a native stream.
  // Unlike a body, `pipeThrough` is not satisfied by async iterability, so
  // every foreign stream has to be adopted here.
  const { body, streamed } = await toUploadBody(makeData(), true)

  expect(streamed).toBe(streams)
  const compressed = streamed
    ? (body as ReadableStream)
    : (body as Blob).stream()
  const text = await readBody(
    compressed.pipeThrough(new DecompressionStream('gzip'))
  )
  expect(text).toBe('hello')
})
