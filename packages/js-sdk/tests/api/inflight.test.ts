import { expect, test, vi } from 'vitest'

import { limitConcurrency } from '../../src/api/inflight'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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

test('limitConcurrency holds the slot while the response body is streaming', async () => {
  // The first fetch resolves with a streaming body. The second request must
  // NOT start until the first body is fully consumed.
  const chunks = [new TextEncoder().encode('hello '), new TextEncoder().encode('world')]
  let chunkIdx = 0

  const streamingBody = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunkIdx < chunks.length) {
        controller.enqueue(chunks[chunkIdx++])
      } else {
        controller.close()
      }
    },
  })

  let secondStarted = false
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/stream')) {
      return new Response(streamingBody)
    }
    secondStarted = true
    return new Response('second')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const first = await limited('https://example.com/stream')
  const second = limited('https://example.com/second')

  // Let microtasks drain — the second request must still be queued because
  // the first body has not been consumed yet.
  await Promise.resolve()
  await Promise.resolve()
  expect(secondStarted).toBe(false)

  // Consume the first body — this should release the slot.
  expect(await first.text()).toBe('hello world')

  // Now the second request can proceed.
  expect(await (await second).text()).toBe('second')
  expect(secondStarted).toBe(true)
})

test('limitConcurrency releases slot when streaming body is cancelled', async () => {
  let innerCalls = 0
  const inner = vi.fn(async () => {
    innerCalls++
    if (innerCalls === 1) {
      return new Response(
        new ReadableStream<Uint8Array>({
          pull() {
            // Never resolves — simulates a long-running stream.
          },
        })
      )
    }
    return new Response('ok')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)

  const first = await limited('https://example.com/stream')
  // Cancel the body without reading it.
  await first.body!.cancel()

  // The slot should be free now.
  const second = await limited('https://example.com/second')
  expect(await second.text()).toBe('ok')
})

test('limitConcurrency releases slot when streaming body read errors', async () => {
  let innerCalls = 0
  const inner = vi.fn(async () => {
    innerCalls++
    if (innerCalls === 1) {
      return new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.error(new Error('stream broke'))
          },
        })
      )
    }
    return new Response('ok')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)

  const first = await limited('https://example.com/stream')
  await expect(first.text()).rejects.toThrow('stream broke')

  // The slot should be free despite the error.
  const second = await limited('https://example.com/second')
  expect(await second.text()).toBe('ok')
})

test('limitConcurrency releases slot immediately for null-body responses', async () => {
  const inner = vi.fn(async () => new Response(null)) as unknown as typeof fetch
  const limited = limitConcurrency(inner, 1)

  const first = await limited('https://example.com/first')
  expect(first.body).toBeNull()

  // The slot should already be free — no body to consume.
  const second = await limited('https://example.com/second')
  expect(await second.text()).toBe('')
})
