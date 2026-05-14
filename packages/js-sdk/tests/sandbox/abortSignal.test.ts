import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox } from '../../src'
import { apiUrl } from '../setup'

const restHandlers = [
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    // Hold the request open until the caller aborts (or the test times out).
    await new Promise<void>((_, reject) => {
      request.signal.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError'))
      )
    })
    return HttpResponse.json({})
  }),
  http.delete(apiUrl('/sandboxes/:sandboxID'), async ({ request }) => {
    await new Promise<void>((_, reject) => {
      request.signal.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError'))
      )
    })
    return HttpResponse.json({})
  }),
  http.get(apiUrl('/v2/sandboxes'), async ({ request }) => {
    await new Promise<void>((_, reject) => {
      request.signal.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError'))
      )
    })
    return HttpResponse.json([])
  }),
]

const server = setupServer(...restHandlers)

beforeAll(() =>
  server.listen({
    onUnhandledRequest: 'bypass',
  })
)

afterAll(() => server.close())

afterEach(() => server.resetHandlers())

test('Sandbox.create rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()

  const promise = Sandbox.create('base', {
    apiKey: 'test-key',
    signal: controller.signal,
  })

  // Abort soon after the request starts.
  setTimeout(() => controller.abort(), 25)

  await expect(promise).rejects.toThrow()
})

test('Sandbox.create rejects immediately when signal is already aborted', async () => {
  const controller = new AbortController()
  controller.abort()

  await expect(
    Sandbox.create('base', {
      apiKey: 'test-key',
      signal: controller.signal,
    })
  ).rejects.toThrow()
})

test('Sandbox.kill rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()

  const promise = Sandbox.kill('some-sandbox', {
    apiKey: 'test-key',
    signal: controller.signal,
  })

  setTimeout(() => controller.abort(), 25)

  await expect(promise).rejects.toThrow()
})

test('SandboxPaginator.nextItems rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()

  const paginator = Sandbox.list({
    apiKey: 'test-key',
    signal: controller.signal,
  })

  const promise = paginator.nextItems()
  setTimeout(() => controller.abort(), 25)

  await expect(promise).rejects.toThrow()
})
