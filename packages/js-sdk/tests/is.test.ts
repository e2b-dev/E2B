import { expect, test, vi } from 'vitest'

import {
  isArrayBufferLike,
  isBlobLike,
  isReadableStreamLike,
  isRequestLike,
} from '../src/is'
import {
  ForeignBlob,
  foreignReadableStream,
  foreignRequestClasses,
} from './foreignPlatformObjects'

test('isRequestLike accepts a Request the current global class disowns', () => {
  const { MintingRequest, GlobalShimRequest } = foreignRequestClasses()
  const request = new MintingRequest('https://example.com/')

  vi.stubGlobal('Request', GlobalShimRequest)
  try {
    // The premise: a real Request that `instanceof` rejects.
    expect(request instanceof globalThis.Request).toBe(false)
    expect(isRequestLike(request)).toBe(true)
  } finally {
    vi.unstubAllGlobals()
  }
})

test('isRequestLike accepts a native Request and rejects other URL carriers', () => {
  expect(isRequestLike(new Request('https://example.com/'))).toBe(true)

  expect(isRequestLike('https://example.com/')).toBe(false)
  expect(isRequestLike(new URL('https://example.com/'))).toBe(false)
  // Node's IncomingMessage shape: a `url`/`method`/`headers` carrier that is
  // not a Request.
  expect(isRequestLike({ url: '/files', method: 'GET', headers: {} })).toBe(
    false
  )
  expect(isRequestLike(null)).toBe(false)
  expect(isRequestLike(undefined)).toBe(false)
})

test('isBlobLike accepts native and foreign Blobs', () => {
  expect(isBlobLike(new Blob(['hi']))).toBe(true)
  expect(isBlobLike(new File(['hi'], 'hi.txt'))).toBe(true)
  expect(isBlobLike(new ForeignBlob(['hi']))).toBe(true)
  // Readable bytes and the tag are enough: implementations without `stream()`
  // still count.
  expect(
    isBlobLike({
      [Symbol.toStringTag]: 'Blob',
      size: 2,
      arrayBuffer: async () => new ArrayBuffer(2),
    })
  ).toBe(true)

  expect(isBlobLike('hi')).toBe(false)
  expect(isBlobLike(new ArrayBuffer(2))).toBe(false)
  expect(isBlobLike(foreignReadableStream([]))).toBe(false)
  // The tag is what separates a Blob from anything else that can hand out bytes.
  expect(isBlobLike({ arrayBuffer: () => {}, stream: () => {} })).toBe(false)
  expect(isBlobLike(new Response('hi'))).toBe(false)
})

test('isReadableStreamLike accepts native and foreign streams', () => {
  expect(isReadableStreamLike(new Blob(['hi']).stream())).toBe(true)
  expect(isReadableStreamLike(foreignReadableStream([]))).toBe(true)

  expect(isReadableStreamLike(new Blob(['hi']))).toBe(false)
  expect(isReadableStreamLike('hi')).toBe(false)
  expect(isReadableStreamLike({ getReader: () => {} })).toBe(false)
})

test('isArrayBufferLike accepts native and cross-realm ArrayBuffers', () => {
  expect(isArrayBufferLike(new ArrayBuffer(2))).toBe(true)
  // A cross-realm ArrayBuffer (`vm.runInContext('new ArrayBuffer(3)')`) keeps
  // the tag while failing `instanceof`.
  expect(
    isArrayBufferLike(Object.create(ArrayBuffer.prototype) as ArrayBuffer)
  ).toBe(true)

  expect(isArrayBufferLike(new Uint8Array(2))).toBe(false)
  expect(isArrayBufferLike(new Blob(['hi']))).toBe(false)
  expect(isArrayBufferLike('hi')).toBe(false)
})
