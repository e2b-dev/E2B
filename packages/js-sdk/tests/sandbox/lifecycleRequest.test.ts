import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { InvalidArgumentError, Sandbox } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

let lastCreateBody: Record<string, unknown> | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  server.resetHandlers()
})

test('Sandbox.create omits autoPause when no lifecycle is configured', async () => {
  // An omitted lifecycle expresses no preference; autoPause: false would be
  // indistinguishable from an explicit 'kill' and would override the API default.
  await Sandbox.create('base', { apiKey: TEST_API_KEY })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('autoPause')
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')
})

test('Sandbox.create sends autoPause: false for an explicit kill', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: 'kill' },
  })

  expect(lastCreateBody?.autoPause).toBe(false)
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')
})

test('Sandbox.create sends autoPause: true for an explicit pause', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: 'pause' },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  // Bare 'pause' expresses no preference about the snapshot kind.
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')
})

test('Sandbox.create omits autoPauseMemory when pause omits keepMemory', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: { action: 'pause' } },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')
})

test('Sandbox.create sends the pause snapshot kind alongside autoPause', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: { action: 'pause', keepMemory: false } },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  expect(lastCreateBody?.autoPauseMemory).toBe(false)

  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: { action: 'pause', keepMemory: true } },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  expect(lastCreateBody?.autoPauseMemory).toBe(true)
})

test('Sandbox.create omits autoPause for a lifecycle without onTimeout', async () => {
  // Untyped callers can build the lifecycle conditionally and leave
  // onTimeout out, or pass it as null; neither selects an action.
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { autoResume: false } as never,
  })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('autoPause')

  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: null } as never,
  })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('autoPause')
})

test('Sandbox.create rejects autoResume without a timeout action', async () => {
  // An unconfigured onTimeout still resolves to kill semantics locally, so
  // autoResume has no pause to attach to.
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      lifecycle: { autoResume: true } as never,
    })
  ).rejects.toThrowError(InvalidArgumentError)

  expect(lastCreateBody).toBeUndefined()
})
