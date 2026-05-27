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
