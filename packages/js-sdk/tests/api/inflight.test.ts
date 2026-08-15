import { expect, test, vi } from 'vitest'

import { limitConcurrency } from '../../src/api/inflight'
import { foreignRequestClasses } from '../foreignPlatformObjects'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** A ReadableStream<Uint8Array> a test can push/close/error on demand. */
function controllableStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    stream,
    push: (chunk: string) => controller.enqueue(new TextEncoder().encode(chunk)),
    close: () => controller.close(),
    error: (reason: unknown) => controller.error(reason),
  }
}

async function readAll(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return new TextDecoder().decode(
    chunks.reduce((acc, chunk) => {
      const merged = new Uint8Array(acc.length + chunk.length)
      merged.set(acc)
      merged.set(chunk, acc.length)
      return merged
    }, new Uint8Array())
  )
}

test('limitConcurrency queues requests over the cap and releases on response', async () => {
  const gate = deferred<Response>()
  let secondStarted = false
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/first')) return gate.promise
    secondStarted = true
    return new Response('second')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const first = limited('https://example.com/first')
  const second = limited('https://example.com/second')

  await Promise.resolve()
  await Promise.resolve()
  expect(secondStarted).toBe(false)

  gate.resolve(new Response('first'))
  expect(await (await first).text()).toBe('first')
  expect(await (await second).text()).toBe('second')
  expect(secondStarted).toBe(true)
})

test('limitConcurrency releases when the underlying fetch rejects', async () => {
  let calls = 0
  const inner = vi.fn(async () => {
    calls++
    if (calls === 1) throw new Error('boom')
    return new Response('ok')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  await expect(limited('https://example.com/a')).rejects.toThrow('boom')

  // Slot should be free for the next request.
  const res = await limited('https://example.com/b')
  expect(await res.text()).toBe('ok')
})

test('limitConcurrency aborts queued requests when their signal fires', async () => {
  const gate = deferred<Response>()
  const inner = vi.fn(async () => gate.promise) as unknown as typeof fetch
  const limited = limitConcurrency(inner, 1)

  // Occupy the only slot.
  const first = limited('https://example.com/first')

  const controller = new AbortController()
  const queued = limited('https://example.com/queued', {
    signal: controller.signal,
  })

  // Abort the queued request before the slot frees.
  controller.abort()
  await expect(queued).rejects.toMatchObject({ name: 'AbortError' })

  // Release the first request to make sure cleanup did not break the slot.
  gate.resolve(new Response('done'))
  const resp = await first
  expect(await resp.text()).toBe('done')
})

test('limitConcurrency honors the signal of a Request the global class disowns', async () => {
  const { MintingRequest, GlobalShimRequest } = foreignRequestClasses()

  const inner = vi.fn(async () => new Response('ok')) as unknown as typeof fetch
  const limited = limitConcurrency(inner, 1)

  const controller = new AbortController()
  controller.abort()
  const request = new MintingRequest('https://example.com/aborted', {
    signal: controller.signal,
  })

  vi.stubGlobal('Request', GlobalShimRequest)
  try {
    expect(request instanceof globalThis.Request).toBe(false)
    await expect(limited(request)).rejects.toMatchObject({
      name: 'AbortError',
    })
  } finally {
    vi.unstubAllGlobals()
  }

  expect(inner).not.toHaveBeenCalled()
})

test('limitConcurrency holds the slot while a streaming body is still being read', async () => {
  const first = controllableStream()
  let secondStarted = false
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/first')) return new Response(first.stream)
    secondStarted = true
    return new Response('second')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const firstResponse = await limited('https://example.com/first')
  const secondPromise = limited('https://example.com/second')

  // Headers are back and the body hasn't been touched — the slot must still
  // be held (this is exactly what the un-fixed version got wrong: it
  // released here, as soon as `fetcher` resolved).
  await Promise.resolve()
  await Promise.resolve()
  expect(secondStarted).toBe(false)

  first.push('chunk')
  first.close()
  expect(await readAll(firstResponse.body!)).toBe('chunk')

  // Draining the body released the slot; the queued request can now start.
  await secondPromise
  expect(secondStarted).toBe(true)
})

test('limitConcurrency releases the slot when the body errors mid-stream', async () => {
  const first = controllableStream()
  let secondStarted = false
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/first')) return new Response(first.stream)
    secondStarted = true
    return new Response('second')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const firstResponse = await limited('https://example.com/first')
  const secondPromise = limited('https://example.com/second')

  first.push('partial')
  first.error(new Error('connection reset'))
  await expect(readAll(firstResponse.body!)).rejects.toThrow(
    'connection reset'
  )

  await secondPromise
  expect(secondStarted).toBe(true)
})

test('limitConcurrency releases the slot when the consumer cancels the body', async () => {
  const first = controllableStream()
  let secondStarted = false
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/first')) return new Response(first.stream)
    secondStarted = true
    return new Response('second')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const firstResponse = await limited('https://example.com/first')
  const secondPromise = limited('https://example.com/second')

  await firstResponse.body!.cancel('no longer needed')

  await secondPromise
  expect(secondStarted).toBe(true)
})

test('limitConcurrency releases immediately for a response with no body', async () => {
  let secondStarted = false
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/first')) {
      return new Response(null, { status: 204 })
    }
    secondStarted = true
    return new Response('second')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  await limited('https://example.com/first')
  await limited('https://example.com/second')

  expect(secondStarted).toBe(true)
})

test('limitConcurrency preserves status, statusText, and headers on the wrapped response', async () => {
  const first = controllableStream()
  const inner = vi.fn(
    async () =>
      new Response(first.stream, {
        status: 201,
        statusText: 'Created',
        headers: { 'x-request-id': 'abc123' },
      })
  ) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const response = await limited('https://example.com/first')

  expect(response.status).toBe(201)
  expect(response.statusText).toBe('Created')
  expect(response.headers.get('x-request-id')).toBe('abc123')

  first.close()
  await readAll(response.body!)
})
