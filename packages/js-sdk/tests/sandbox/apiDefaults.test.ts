import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import { InvalidArgumentError, Sandbox, ServiceBusyError } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

let lastCreateBody: Record<string, unknown> | undefined
let lastForkBody: Record<string, unknown> | undefined
let lastPauseBody: Record<string, unknown> | undefined
let lastSnapshotBody: Record<string, unknown> | undefined
let lastConnectBody: Record<string, unknown> | undefined

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  }),
  http.post(apiUrl('/v2/sandboxes/:sandboxID/connect'), async ({ request }) => {
    lastConnectBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  }),
  http.post(apiUrl('/sandboxes/:sandboxID/fork'), async ({ request }) => {
    lastForkBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json([
      {
        sandbox: {
          sandboxID: 'forked-sandbox-id',
          templateID: 'base',
          envdVersion: '0.2.4',
        },
      },
    ])
  }),
  http.post(apiUrl('/sandboxes/:sandboxID/pause'), async ({ request }) => {
    lastPauseBody = (await request.json()) as Record<string, unknown>
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(apiUrl('/sandboxes/:sandboxID/snapshots'), async ({ request }) => {
    lastSnapshotBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { snapshotID: 'test-snapshot-id', names: [] },
      { status: 201 }
    )
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  lastForkBody = undefined
  lastPauseBody = undefined
  lastSnapshotBody = undefined
  lastConnectBody = undefined
  server.resetHandlers()
})

test('Sandbox.create omits timeout and allow_internet_access when unset', async () => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('timeout')
  expect(lastCreateBody).not.toHaveProperty('secure')
  expect(lastCreateBody).not.toHaveProperty('allow_internet_access')
})

test('Sandbox.create ignores the deprecated secure option', async () => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY, secure: true })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('secure')
})

test('Sandbox.create sends explicit timeout and allow_internet_access', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    timeoutMs: 60_000,
    allowInternetAccess: false,
  })

  expect(lastCreateBody?.timeout).toBe(60)
  expect(lastCreateBody?.allow_internet_access).toBe(false)
})

test('Sandbox.fork omits timeout and count when unset', async () => {
  await Sandbox.fork('test-sandbox-id', { apiKey: TEST_API_KEY })

  expect(lastForkBody).toBeDefined()
  expect(lastForkBody).not.toHaveProperty('timeout')
  expect(lastForkBody).not.toHaveProperty('count')
})

test('Sandbox.fork sends explicit timeout and count', async () => {
  await Sandbox.fork('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    timeoutMs: 60_000,
    count: 2,
  })

  expect(lastForkBody?.timeout).toBe(60)
  expect(lastForkBody?.count).toBe(2)
})

test('Sandbox.fork sends the maximum count', async () => {
  await Sandbox.fork('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    count: 20,
  })

  expect(lastForkBody?.count).toBe(20)
})

test.each([0, -1, 21, 101, 1.5])(
  'Sandbox.fork rejects count %s',
  async (count) => {
    await expect(
      Sandbox.fork('test-sandbox-id', { apiKey: TEST_API_KEY, count })
    ).rejects.toThrow(
      new InvalidArgumentError('count must be an integer between 1 and 20')
    )
    expect(lastForkBody).toBeUndefined()
  }
)

test('Sandbox.pause omits memory when mode is unset', async () => {
  await Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY })

  expect(lastPauseBody).toBeDefined()
  expect(lastPauseBody).not.toHaveProperty('memory')
})

test.each([
  ['filesystem', false],
  ['full', true],
] as const)('Sandbox.pause maps mode %s to memory %s', async (mode, memory) => {
  await Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY, mode })

  expect(lastPauseBody?.memory).toBe(memory)
})

test('Sandbox.pause still sends the deprecated keepMemory', async () => {
  await Sandbox.pause('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    keepMemory: false,
  })

  expect(lastPauseBody?.memory).toBe(false)
})

test('Sandbox.pause requires a healthy guest by default', async () => {
  await Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY })

  expect(lastPauseBody?.requireHealthyGuest).toBe(true)
})

test('Sandbox.pause with force skips the guest health requirement', async () => {
  await Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY, force: true })

  expect(lastPauseBody?.requireHealthyGuest).toBe(false)
})

test.each([[{ mode: 'filesystem' }], [{ keepMemory: false }]] as const)(
  'Sandbox.pause rejects force with %o',
  async (opts) => {
    await expect(
      Sandbox.pause('test-sandbox-id', {
        apiKey: TEST_API_KEY,
        force: true,
        ...opts,
      })
    ).rejects.toThrowError(InvalidArgumentError)
    expect(lastPauseBody).toBeUndefined()
  }
)

test('Sandbox.pause rejects mode together with keepMemory', async () => {
  await expect(
    Sandbox.pause('test-sandbox-id', {
      apiKey: TEST_API_KEY,
      mode: 'full',
      keepMemory: true,
    })
  ).rejects.toThrowError(InvalidArgumentError)
  expect(lastPauseBody).toBeUndefined()
})

test('Sandbox.pause rejects an unknown mode', async () => {
  await expect(
    Sandbox.pause('test-sandbox-id', {
      apiKey: TEST_API_KEY,
      mode: 'memory' as never,
    })
  ).rejects.toThrow(
    new InvalidArgumentError(
      'mode must be one of: full, filesystem (got "memory").'
    )
  )
  expect(lastPauseBody).toBeUndefined()
})

test('Sandbox.createSnapshot omits memory when mode is unset', async () => {
  await Sandbox.createSnapshot('test-sandbox-id', { apiKey: TEST_API_KEY })

  expect(lastSnapshotBody).toBeDefined()
  expect(lastSnapshotBody).not.toHaveProperty('memory')
})

test.each([
  ['filesystem', false],
  ['full', true],
] as const)(
  'Sandbox.createSnapshot maps mode %s to memory %s',
  async (mode, memory) => {
    await Sandbox.createSnapshot('test-sandbox-id', {
      apiKey: TEST_API_KEY,
      mode,
    })

    expect(lastSnapshotBody?.memory).toBe(memory)
  }
)

test('Sandbox.connect omits timeout when unset', async () => {
  await Sandbox.connect('test-sandbox-id', { apiKey: TEST_API_KEY })

  expect(lastConnectBody).toBeDefined()
  expect(lastConnectBody).not.toHaveProperty('timeout')
})

test('Sandbox.connect sends an explicit timeout', async () => {
  await Sandbox.connect('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    timeoutMs: 60_000,
  })

  expect(lastConnectBody?.timeout).toBe(60)
})

test.each([
  [false, true],
  [true, false],
])(
  'Sandbox.pause with force=%s hints force on a busy error: %s',
  async (force, hinted) => {
    server.use(
      http.post(apiUrl('/sandboxes/:sandboxID/pause'), () =>
        HttpResponse.json(
          { code: 503, message: 'guest agent is not responding' },
          { status: 503 }
        )
      )
    )

    const err = await Sandbox.pause('test-sandbox-id', {
      apiKey: TEST_API_KEY,
      retries: 0,
      force,
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ServiceBusyError)
    expect((err as Error).message.includes('force: true')).toBe(hinted)
  }
)

test.each([
  ['paused', true, false],
  ['paused', undefined, true],
  ['running', undefined, undefined],
] as const)(
  'Sandbox.getInfo maps a %s sandbox with envdUnresponsiveAtPause=%s to pauseIsHealthy=%s',
  async (state, value, expected) => {
    server.use(
      http.get(apiUrl('/sandboxes/:sandboxID'), () =>
        HttpResponse.json({
          templateID: 'base',
          sandboxID: 'test-sandbox-id',
          clientID: 'client',
          startedAt: '2026-01-01T00:00:00Z',
          endAt: '2026-01-01T01:00:00Z',
          envdVersion: '0.2.4',
          cpuCount: 2,
          memoryMB: 512,
          diskSizeMB: 1024,
          state,
          ...(value !== undefined && { envdUnresponsiveAtPause: value }),
        })
      )
    )

    const info = await Sandbox.getInfo('test-sandbox-id', {
      apiKey: TEST_API_KEY,
    })

    expect(info.pauseIsHealthy).toBe(expected)
  }
)
