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

test('limitConcurrency queues requests over the cap and releases on body end', async () => {
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

  // Headers arriving must not free the slot while the body is unread.
  gate.resolve(new Response('first'))
  const firstResponse = await first
  await Promise.resolve()
  await Promise.resolve()
  expect(secondStarted).toBe(false)

  expect(await firstResponse.text()).toBe('first')
  expect(await (await second).text()).toBe('second')
  expect(secondStarted).toBe(true)
})

test('limitConcurrency releases when the response body is cancelled', async () => {
  const inner = vi.fn(
    async () =>
      new Response(
        // A stream that never ends on its own; only cancel frees the slot.
        new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) })
      )
  ) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const first = await limited('https://example.com/first')

  let secondStarted = false
  const second = limited('https://example.com/second').then((res) => {
    secondStarted = true
    return res
  })

  await Promise.resolve()
  await Promise.resolve()
  expect(secondStarted).toBe(false)

  await first.body!.cancel()
  const secondResponse = await second
  expect(secondStarted).toBe(true)
  await secondResponse.body!.cancel()
})

test('limitConcurrency releases when the response body errors', async () => {
  let calls = 0
  const inner = vi.fn(async () => {
    calls++
    if (calls === 1) {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.error(new Error('body boom'))
          },
        })
      )
    }
    return new Response('ok')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const first = await limited('https://example.com/first')
  await expect(first.text()).rejects.toThrow('body boom')

  const second = await limited('https://example.com/second')
  expect(await second.text()).toBe('ok')
})

test('limitConcurrency releases when the body errors between pulls', async () => {
  let controllerRef!: ReadableStreamDefaultController<Uint8Array>
  const inner = vi.fn(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controllerRef = controller
            // One chunk fills the passthrough queue so no read is pending
            // when the source errors later.
            controller.enqueue(new Uint8Array([1]))
          },
        })
      )
  ) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  await limited('https://example.com/first')

  let secondStarted = false
  const second = limited('https://example.com/second').then((res) => {
    secondStarted = true
    return res
  })

  await Promise.resolve()
  await Promise.resolve()
  expect(secondStarted).toBe(false)

  // The consumer never reads; only the source terminating can free the slot.
  controllerRef.error(new Error('late boom'))
  const secondResponse = await second
  expect(secondStarted).toBe(true)
  await secondResponse.body!.cancel()
})

test('limitConcurrency releases immediately for bodiless responses', async () => {
  const inner = vi.fn(
    async () => new Response(null, { status: 204 })
  ) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const first = await limited('https://example.com/first')
  expect(first.status).toBe(204)

  // The slot must be free even though the first body was never consumed.
  const second = await limited('https://example.com/second')
  expect(second.status).toBe(204)
})

test('limitConcurrency releases immediately for content-length: 0 responses', async () => {
  const inner = vi.fn(
    async () =>
      new Response('', { status: 200, headers: { 'content-length': '0' } })
  ) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const first = await limited('https://example.com/first')
  expect(first.status).toBe(200)
  // openapi-fetch never touches these bodies; releasing must not depend on a
  // consumer (or an eager pull) reading them.
  expect(first.bodyUsed).toBe(false)
  expect(first.body?.locked ?? false).toBe(false)

  const second = await limited('https://example.com/second')
  expect(second.status).toBe(200)
})

test('limitConcurrency releases immediately for HEAD responses', async () => {
  const inner = vi.fn(
    async () =>
      // A HEAD response's Content-Length describes the body the same GET
      // would have returned; no bytes ever arrive.
      new Response(null, { status: 200, headers: { 'content-length': '42' } })
  ) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  await limited('https://example.com/first', { method: 'HEAD' })

  const second = await limited('https://example.com/second', {
    method: 'HEAD',
  })
  expect(second.status).toBe(200)
})

test('limitConcurrency releases immediately when the body is already locked or used', async () => {
  let calls = 0
  const inner = vi.fn(async () => {
    calls++
    if (calls === 1) {
      // A mock/interceptor got to the body first.
      const res = new Response('spoken for')
      res.body!.getReader()
      return res
    }
    if (calls === 2) {
      const res = new Response('consumed')
      await res.text()
      return res
    }
    return new Response('ok')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  // Must not throw (getReader on a locked body) and must not leak the slot.
  const locked = await limited('https://example.com/locked')
  expect(locked.body!.locked).toBe(true)

  const used = await limited('https://example.com/used')
  expect(used.bodyUsed).toBe(true)

  const third = await limited('https://example.com/third')
  expect(await third.text()).toBe('ok')
})

test('limitConcurrency reserves unary capacity from Connect streaming requests', async () => {
  const streams: ReadableStreamDefaultController<Uint8Array>[] = []
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('/stream')) {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            streams.push(controller)
          },
        })
      )
    }
    return new Response(null, { status: 204 })
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 2, { reserved: 1 })
  const streamingInit = {
    method: 'POST',
    headers: { 'content-type': 'application/connect+json' },
  }

  // Only max - reserved = 1 streaming slot: the second stream queues.
  await limited('https://example.com/stream/1', streamingInit)
  let secondStreamStarted = false
  const secondStream = limited('https://example.com/stream/2', streamingInit)
  void secondStream.then(() => {
    secondStreamStarted = true
  })
  await Promise.resolve()
  await Promise.resolve()
  expect(secondStreamStarted).toBe(false)

  // The reserved slot keeps unary/control calls runnable while the stream
  // holds its slot open.
  const unary = await limited('https://example.com/kill')
  expect(unary.status).toBe(204)
  expect(secondStreamStarted).toBe(false)

  // Ending the first stream admits the queued one.
  streams[0].close()
  const second = await secondStream
  expect(secondStreamStarted).toBe(true)
  await second.body!.cancel()
})

test('limitConcurrency lets unary overflow when the cap is too small to reserve', async () => {
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('/stream')) {
      return new Response(
        new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) })
      )
    }
    return new Response(null, { status: 204 })
  }) as unknown as typeof fetch

  // max=1, reserved=1: the stream may still start (streaming budget never
  // drops below 1) and unary gets one overflow slot beyond max.
  const limited = limitConcurrency(inner, 1, { reserved: 1 })
  const stream = await limited('https://example.com/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/connect+json' },
  })

  const kill = await limited('https://example.com/kill')
  expect(kill.status).toBe(204)

  await stream.body!.cancel()
})

test('limitConcurrency names the env var when a queued request aborts', async () => {
  const inner = vi.fn(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) })
      )
  ) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1, {
    envVarName: 'E2B_TEST_INFLIGHT_REQUESTS',
  })
  const first = await limited('https://example.com/first')

  const controller = new AbortController()
  const queued = limited('https://example.com/queued', {
    signal: controller.signal,
  })
  controller.abort(new DOMException('deadline', 'TimeoutError'))

  await expect(queued).rejects.toMatchObject({
    name: 'TimeoutError',
    message: expect.stringContaining('E2B_TEST_INFLIGHT_REQUESTS'),
  })

  await first.body!.cancel()
})

test('limitConcurrency preserves response fields on the wrapped response', async () => {
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    const res = new Response('payload', {
      status: 201,
      statusText: 'Created',
      headers: { 'x-custom': 'yes' },
    })
    Object.defineProperties(res, {
      url: { get: () => String(input) },
      redirected: { get: () => true },
    })
    return res
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const res = await limited('https://example.com/resource')

  expect(res.status).toBe(201)
  expect(res.statusText).toBe('Created')
  expect(res.headers.get('x-custom')).toBe('yes')
  expect(res.url).toBe('https://example.com/resource')
  expect(res.redirected).toBe(true)
  expect(await res.text()).toBe('payload')
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
