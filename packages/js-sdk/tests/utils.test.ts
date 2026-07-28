import { expect, test } from 'vitest'

import { runtime, sha256, toBlob, toUploadBody } from '../src/utils'
import { ForeignBlob, foreignReadableStream } from './foreignPlatformObjects'

const encode = (text: string) => new TextEncoder().encode(text)

// Browsers can't stream request bodies, so everything is buffered there.
const streams = runtime !== 'browser'

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
  ['foreign Blob', () => new ForeignBlob(['hello'])],
  ['string', () => 'hello'],
])('toUploadBody gzips a %s', async (_name, makeData) => {
  // Regression: piping a foreign stream through a native CompressionStream
  // never settles, so gzip uploads hung for anything but a native stream.
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
