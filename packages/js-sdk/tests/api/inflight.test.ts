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

/** Let every pending microtask chain settle. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * A response whose body is fed chunk by chunk from the test, standing in for one
 * that is still streaming off the wire after `fetch` resolved with its headers.
 */
function streamingResponse(init?: ResponseInit) {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c
      },
    }),
    init
  )
  const encoder = new TextEncoder()

  return {
    response,
    send: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
    end: () => controller.close(),
    fail: (reason: unknown) => controller.error(reason),
  }
}

/**
 * A limiter of one whose single slot can be inspected: `slotIsFree` dispatches a
 * throwaway request, which only reaches `respond` once the slot has been handed
 * back. A probe that doesn't get in is aborted so it can't take the slot later.
 */
function singleSlotLimiter(respond: () => Response | Promise<Response>) {
  const probeUrl = 'https://example.com/probe'
  const inner = vi.fn(async (input: RequestInfo | URL) =>
    String(input) === probeUrl ? new Response('probe') : await respond()
  ) as unknown as typeof fetch
  const limited = limitConcurrency(inner, 1)

  return {
    limited,
    async slotIsFree() {
      const pending = Symbol('pending')
      const controller = new AbortController()
      const probe = limited(probeUrl, { signal: controller.signal })

      await flush()
      const result = await Promise.race([probe, Promise.resolve(pending)])
      if (result === pending) {
        controller.abort()
        await probe.catch(() => {})
        return false
      }

      // Drain the probe so it hands the slot back to the next caller.
      await (result as Response).text()
      return true
    },
  }
}

test('limitConcurrency queues requests over the cap and releases on body end', async () => {
  const stream = streamingResponse()
  let secondStarted = false
  const inner = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/first')) return stream.response
    secondStarted = true
    return new Response('second')
  }) as unknown as typeof fetch

  const limited = limitConcurrency(inner, 1)
  const first = await limited('https://example.com/first')
  const second = limited('https://example.com/second')

  // The headers are in, but the dispatcher is still holding a connection for
  // the body that is streaming over it, so the slot stays taken.
  await flush()
  expect(secondStarted).toBe(false)

  stream.send('first')
  stream.send(' chunk')
  stream.end()
  expect(await first.text()).toBe('first chunk')

  expect(await (await second).text()).toBe('second')
  expect(secondStarted).toBe(true)
})

test('limitConcurrency releases the slot when the body is cancelled', async () => {
  const stream = streamingResponse()
  const { limited, slotIsFree } = singleSlotLimiter(() => stream.response)

  const response = await limited('https://example.com/stream')
  expect(await slotIsFree()).toBe(false)

  await response.body!.cancel()
  expect(await slotIsFree()).toBe(true)
})

test('limitConcurrency releases the slot when the body errors mid-stream', async () => {
  const stream = streamingResponse()
  const { limited, slotIsFree } = singleSlotLimiter(() => stream.response)

  const response = await limited('https://example.com/stream')
  stream.send('partial')
  // The shape a request aborted (or timed out) mid-body arrives in.
  stream.fail(new DOMException('Aborted', 'AbortError'))

  await expect(response.text()).rejects.toMatchObject({ name: 'AbortError' })
  expect(await slotIsFree()).toBe(true)
})

// The three responses below are handed to the caller with their body untouched
// (`openapi-fetch` returns early for all of them), so a slot waiting on a body
// to end would never come back.
test('limitConcurrency releases the slot for a null-body status', async () => {
  const response = new Response(null, { status: 204 })
  const { limited, slotIsFree } = singleSlotLimiter(() => response)

  expect(await limited('https://example.com/a')).toBe(response)
  expect(await slotIsFree()).toBe(true)
})

test('limitConcurrency releases the slot for an empty body', async () => {
  const response = new Response('', { headers: { 'content-length': '0' } })
  const { limited, slotIsFree } = singleSlotLimiter(() => response)

  expect(await limited('https://example.com/a')).toBe(response)
  expect(await slotIsFree()).toBe(true)
})

test('limitConcurrency releases the slot for a HEAD response', async () => {
  // Content-Length describes the body the same GET would return, not the zero
  // bytes a HEAD actually sends.
  const response = new Response('bytes only a GET would receive', {
    headers: { 'content-length': '30' },
  })
  const { limited, slotIsFree } = singleSlotLimiter(() => response)

  expect(await limited('https://example.com/a', { method: 'head' })).toBe(
    response
  )
  expect(await slotIsFree()).toBe(true)
})

test('limitConcurrency releases the slot for a body an interceptor already read', async () => {
  const { limited, slotIsFree } = singleSlotLimiter(async () => {
    const response = new Response('consumed before the limiter saw it')
    await response.text()
    return response
  })

  const response = await limited('https://example.com/a')
  expect(response.bodyUsed).toBe(true)
  expect(await slotIsFree()).toBe(true)
})

test('limitConcurrency keeps the status and headers of the wrapped response', async () => {
  const inner = vi.fn(
    async () =>
      new Response('payload', {
        status: 201,
        statusText: 'Created',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-1',
        },
      })
  ) as unknown as typeof fetch

  const response = await limitConcurrency(inner, 1)('https://example.com/a')

  expect(response.status).toBe(201)
  expect(response.statusText).toBe('Created')
  expect(response.ok).toBe(true)
  expect(response.headers.get('content-type')).toBe('application/json')
  expect(response.headers.get('x-request-id')).toBe('req-1')
  expect(await response.text()).toBe('payload')
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
