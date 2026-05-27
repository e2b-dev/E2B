import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template } from '../../src'
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
  http.post(apiUrl('/v3/templates'), async ({ request }) => {
    await holdUntilAborted(request.signal)
    return HttpResponse.json({})
  }),
  http.get(apiUrl('/templates/aliases/:alias'), async ({ request }) => {
    await holdUntilAborted(request.signal)
    return HttpResponse.json({})
  }),
  http.get(
    apiUrl('/templates/:templateID/builds/:buildID/status'),
    async ({ request }) => {
      await holdUntilAborted(request.signal)
      return HttpResponse.json({})
    }
  ),
  http.post(apiUrl('/templates/tags'), async ({ request }) => {
    await holdUntilAborted(request.signal)
    return HttpResponse.json({})
  }),
  http.delete(apiUrl('/templates/tags'), async ({ request }) => {
    await holdUntilAborted(request.signal)
    return HttpResponse.json({})
  }),
  http.get(apiUrl('/templates/:templateID/tags'), async ({ request }) => {
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

test('Template.build rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()
  const requestStarted = nextRequestStart()

  const template = Template().fromBaseImage()
  const promise = Template.build(template, 'test-template', {
    apiKey: 'e2b_testkey',
    signal: controller.signal,
  })

  await requestStarted
  controller.abort()

  await expect(promise).rejects.toThrow()
})

test('Template.build rejects immediately when signal is already aborted', async () => {
  const controller = new AbortController()
  controller.abort()

  const template = Template().fromBaseImage()
  await expect(
    Template.build(template, 'test-template', {
      apiKey: 'e2b_testkey',
      signal: controller.signal,
    })
  ).rejects.toThrow()
})

test('Template.buildInBackground rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()
  const requestStarted = nextRequestStart()

  const template = Template().fromBaseImage()
  const promise = Template.buildInBackground(template, 'test-template', {
    apiKey: 'e2b_testkey',
    signal: controller.signal,
  })

  await requestStarted
  controller.abort()

  await expect(promise).rejects.toThrow()
})

test('Template.exists rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()
  const requestStarted = nextRequestStart()

  const promise = Template.exists('some-template', {
    apiKey: 'e2b_testkey',
    signal: controller.signal,
  })

  await requestStarted
  controller.abort()

  await expect(promise).rejects.toThrow()
})

test('Template.getBuildStatus rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()
  const requestStarted = nextRequestStart()

  const promise = Template.getBuildStatus(
    { templateId: 'tpl-1', buildId: 'build-1' },
    {
      apiKey: 'e2b_testkey',
      signal: controller.signal,
    }
  )

  await requestStarted
  controller.abort()

  await expect(promise).rejects.toThrow()
})

test('Template.assignTags rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()
  const requestStarted = nextRequestStart()

  const promise = Template.assignTags('some-template:v1', 'stable', {
    apiKey: 'e2b_testkey',
    signal: controller.signal,
  })

  await requestStarted
  controller.abort()

  await expect(promise).rejects.toThrow()
})

test('Template.removeTags rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()
  const requestStarted = nextRequestStart()

  const promise = Template.removeTags('some-template', 'stable', {
    apiKey: 'e2b_testkey',
    signal: controller.signal,
  })

  await requestStarted
  controller.abort()

  await expect(promise).rejects.toThrow()
})

test('Template.getTags rejects when AbortSignal is aborted', async () => {
  const controller = new AbortController()
  const requestStarted = nextRequestStart()

  const promise = Template.getTags('some-template', {
    apiKey: 'e2b_testkey',
    signal: controller.signal,
  })

  await requestStarted
  controller.abort()

  await expect(promise).rejects.toThrow()
})
