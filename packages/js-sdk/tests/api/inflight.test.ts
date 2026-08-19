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
