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
  expect(lastCreateBody).not.toHaveProperty('autoResume')
})

test('Sandbox.create sends autoPause: false for an explicit kill', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: 'kill' },
  })

  expect(lastCreateBody?.autoPause).toBe(false)
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')
  expect(lastCreateBody).not.toHaveProperty('autoResume')
})

test('Sandbox.create sends autoPause: true for an explicit pause', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: 'pause' },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  // Bare 'pause' expresses no preference about the snapshot kind.
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')
  expect(lastCreateBody).not.toHaveProperty('autoResume')
})

test('Sandbox.create omits autoPauseMemory when pause omits keepMemory', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: { action: 'pause' } },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')
  expect(lastCreateBody).not.toHaveProperty('autoResume')
})

test('Sandbox.create sends the pause snapshot kind alongside autoPause', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: { action: 'pause', keepMemory: false } },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  expect(lastCreateBody?.autoPauseMemory).toBe(false)
  expect(lastCreateBody).not.toHaveProperty('autoResume')

  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: { action: 'pause', keepMemory: true } },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  expect(lastCreateBody?.autoPauseMemory).toBe(true)
  expect(lastCreateBody).not.toHaveProperty('autoResume')
})

test('Sandbox.create omits autoPause for a lifecycle without onTimeout', async () => {
  // onTimeout is optional, so opting out of auto-resume without expressing a
  // preference about the timeout action is a typed call, not a cast.
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { autoResume: false },
  })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('autoPause')
  expect(lastCreateBody?.autoResume).toEqual({ enabled: false })

  // An empty lifecycle expresses nothing at all.
  await Sandbox.create('base', { apiKey: TEST_API_KEY, lifecycle: {} })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('autoPause')
  expect(lastCreateBody).not.toHaveProperty('autoResume')

  // Untyped callers can also pass onTimeout as null; that selects no action
  // either.
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: null } as never,
  })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('autoPause')
  expect(lastCreateBody).not.toHaveProperty('autoResume')
})

test('Sandbox.create rejects autoResume without a timeout action', async () => {
  // Auto-resume only has meaning for a sandbox that pauses, so it needs an
  // explicit 'pause' rather than whichever action the API would have picked.
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      lifecycle: { autoResume: true },
    })
  ).rejects.toThrowError(InvalidArgumentError)

  expect(lastCreateBody).toBeUndefined()

  // The message points at the knob to turn instead of naming a default the SDK
  // no longer decides.
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      lifecycle: { autoResume: true },
    })
  ).rejects.toThrowError(/Set lifecycle.onTimeout to 'pause'/)
})

test('an explicit autoResume: false is sent', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: 'pause', autoResume: false },
  })

  expect(lastCreateBody?.autoResume).toEqual({ enabled: false })
})

test('an explicit autoResume: true is sent', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: 'pause', autoResume: true },
  })

  expect(lastCreateBody?.autoResume).toEqual({ enabled: true })
})

test('an explicit null autoResume from an untyped caller is omitted', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    // @ts-expect-error null is not a valid autoResume value
    lifecycle: { onTimeout: 'pause', autoResume: null },
  })

  expect(lastCreateBody).not.toHaveProperty('autoResume')
})

test('a nullish keepMemory is not a choice of snapshot kind', async () => {
  // Spreading an optional value in yields `keepMemory: undefined`, which is no
  // more a choice than leaving the key out.
  const unset: boolean | undefined = undefined

  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: { action: 'pause', keepMemory: unset } },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')

  // It therefore doesn't trip the pause-only guard on a kill action either.
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: { action: 'kill', keepMemory: unset } as never },
  })

  expect(lastCreateBody?.autoPause).toBe(false)
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')
})

test('a nullish keepMemory still allows autoResume', async () => {
  const unset: boolean | undefined = undefined

  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: {
      onTimeout: { action: 'pause', keepMemory: unset },
      autoResume: true,
    },
  })

  expect(lastCreateBody?.autoPause).toBe(true)
  expect(lastCreateBody).not.toHaveProperty('autoPauseMemory')
  expect(lastCreateBody?.autoResume).toEqual({ enabled: true })
})
