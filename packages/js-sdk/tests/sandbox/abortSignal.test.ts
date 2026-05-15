import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox } from '../../src'
import { apiUrl } from '../setup'

// Hold the request open until the caller aborts. If the signal is already
// aborted by the time the handler runs, `addEventListener('abort', …)` would
// never fire — so check `aborted` first to avoid hanging.
function holdUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_, reject) => {
    const abort = () => reject(new DOMException('aborted', 'AbortError'))
    if (signal.aborted) {
      abort()
      return
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}

const restHandlers = [
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    await holdUntilAborted(request.signal)
    return HttpResponse.json({})
  }),
  http.delete(apiUrl('/sandboxes/:sandboxID'), async ({ request }) => {
    await holdUntilAborted(request.signal)
    return HttpResponse.json({})
  }),
  http.get(apiUrl('/v2/sandboxes'), async ({ request }) => {
    await holdUntilAborted(request.signal)
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

// Resolves once MSW has dispatched the next request, so tests can abort
// deterministically instead of guessing with `setTimeout`.
function nextRequestStart(): Promise<void> {
  return new Promise<void>((resolve) => {
    const listener = () => {
      server.events.removeListener('request:start', listener)
      resolve()
    }
    server.events.on('request:start', listener)
  })
}

test('Sandbox.create rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()
  const requestStarted = nextRequestStart()

  const promise = Sandbox.create('base', {
    apiKey: 'test-key',
    signal: controller.signal,
  })

  await requestStarted
  controller.abort()

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
  const requestStarted = nextRequestStart()

  const promise = Sandbox.kill('some-sandbox', {
    apiKey: 'test-key',
    signal: controller.signal,
  })

  await requestStarted
  controller.abort()

  await expect(promise).rejects.toThrow()
})

test('SandboxPaginator.nextItems rejects when per-call AbortSignal is aborted', async () => {
  const controller = new AbortController()
  const requestStarted = nextRequestStart()

  const paginator = Sandbox.list({ apiKey: 'test-key' })
  const promise = paginator.nextItems({ signal: controller.signal })

  await requestStarted
  controller.abort()

  await expect(promise).rejects.toThrow()
})
