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
  // Untyped callers can build the lifecycle conditionally and leave
  // onTimeout out, or pass it as null; neither selects an action.
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { autoResume: false } as never,
  })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('autoPause')
  expect(lastCreateBody?.autoResume).toEqual({ enabled: false })

  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: null } as never,
  })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('autoPause')
  expect(lastCreateBody).not.toHaveProperty('autoResume')
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

async function expectInvalidLifecycleWithoutApiKey(
  lifecycle: NonNullable<Parameters<typeof Sandbox.create>[1]>['lifecycle']
) {
  const previous = process.env.E2B_API_KEY
  delete process.env.E2B_API_KEY
  try {
    await expect(Sandbox.create('base', { lifecycle })).rejects.toThrowError(
      InvalidArgumentError
    )
  } finally {
    if (previous === undefined) {
      delete process.env.E2B_API_KEY
    } else {
      process.env.E2B_API_KEY = previous
    }
  }
  expect(lastCreateBody).toBeUndefined()
}

test('filesystem-only auto-pause with auto-resume is InvalidArgumentError without an API key', async () => {
  await expectInvalidLifecycleWithoutApiKey({
    onTimeout: { action: 'pause', keepMemory: false },
    autoResume: true,
  })
})

test('keepMemory on kill is InvalidArgumentError without an API key', async () => {
  await expectInvalidLifecycleWithoutApiKey({
    // @ts-expect-error keepMemory is not allowed with action: 'kill'
    onTimeout: { action: 'kill', keepMemory: false },
  })
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
