import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import {
  InvalidArgumentError,
  Sandbox,
  SandboxError,
  SandboxNotFoundError,
} from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

const sandboxId = 'test-sandbox-id'

let lastCreateBody: Record<string, unknown> | undefined
let lastRetentionBody: string | undefined

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      sandboxID: sandboxId,
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  }),
  http.put(
    apiUrl(`/sandboxes/${sandboxId}/paused-retention`),
    async ({ request }) => {
      // Kept as text: an explicit null must reach the wire, not be dropped.
      lastRetentionBody = await request.text()
      return new HttpResponse(null, { status: 204 })
    }
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  lastRetentionBody = undefined
  server.resetHandlers()
})

const DAY_MS = 24 * 3600_000

test.for([
  [3_600_000, 3600],
  [7 * DAY_MS, 604_800],
  [3_153_600_000_000, 3_153_600_000],
] as const)(
  'create sends a paused retention of %i ms as %i seconds',
  async ([pausedRetentionMs, seconds]) => {
    await Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      lifecycle: { onTimeout: 'pause', autoResume: true, pausedRetentionMs },
    })

    expect(lastCreateBody?.pausedRetentionSeconds).toBe(seconds)
    expect(lastCreateBody?.autoPause).toBe(true)
  }
)

test('create omits the paused retention when it is not set', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: 'pause' },
  })
  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('pausedRetentionSeconds')

  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    // @ts-expect-error null is not a valid pausedRetentionMs value
    lifecycle: { onTimeout: 'pause', pausedRetentionMs: null },
  })
  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('pausedRetentionSeconds')
})

// Not whole seconds, or not a finite number: these cannot be converted to the
// seconds the API takes.
const unconvertibleRetentions = [
  3_600_500,
  1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  '3600000',
]

test.for(unconvertibleRetentions)(
  'create rejects a paused retention of %o before calling the API',
  async (pausedRetentionMs) => {
    await expect(
      Sandbox.create('base', {
        apiKey: TEST_API_KEY,
        lifecycle: {
          onTimeout: 'pause',
          pausedRetentionMs: pausedRetentionMs as number,
        },
      })
    ).rejects.toThrowError(new RegExp('^lifecycle\\.pausedRetentionMs must be'))

    expect(lastCreateBody).toBeUndefined()
  }
)

// The allowed range (1 hour to 100 years) is the API's to enforce, so values
// outside it go out unchanged and the API answers.
const outOfRangeRetentions = [
  [3_599_000, 3599],
  [0, 0],
  [-3_600_000, -3600],
  [3_153_600_001_000, 3_153_600_001],
] as const

test.for(outOfRangeRetentions)(
  'create sends an out-of-range paused retention of %i ms as %i seconds',
  async ([pausedRetentionMs, seconds]) => {
    await Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      lifecycle: { onTimeout: 'pause', pausedRetentionMs },
    })

    expect(lastCreateBody?.pausedRetentionSeconds).toBe(seconds)
  }
)

test.for([
  [DAY_MS, '{"pausedRetentionSeconds":86400}'],
  [null, '{"pausedRetentionSeconds":null}'],
  ...outOfRangeRetentions.map(
    ([ms, seconds]) => [ms, `{"pausedRetentionSeconds":${seconds}}`] as const
  ),
] as const)(
  'Sandbox.setPausedRetention(%o) sends %s',
  async ([retentionMs, body]) => {
    await Sandbox.setPausedRetention(sandboxId, retentionMs, {
      apiKey: TEST_API_KEY,
    })

    expect(lastRetentionBody).toBe(body)
  }
)

test('sandbox.setPausedRetention sets the retention of that sandbox', async () => {
  const sandbox = await Sandbox.create('base', { apiKey: TEST_API_KEY })

  await sandbox.setPausedRetention(2 * DAY_MS)
  expect(lastRetentionBody).toBe('{"pausedRetentionSeconds":172800}')

  await sandbox.setPausedRetention(null)
  expect(lastRetentionBody).toBe('{"pausedRetentionSeconds":null}')
})

test.for([...unconvertibleRetentions, undefined])(
  'setPausedRetention rejects %o before calling the API',
  async (retentionMs) => {
    await expect(
      Sandbox.setPausedRetention(sandboxId, retentionMs as number, {
        apiKey: TEST_API_KEY,
      })
    ).rejects.toThrowError(InvalidArgumentError)

    expect(lastRetentionBody).toBeUndefined()
  }
)

test('Sandbox.setPausedRetention makes no request in debug mode', async () => {
  // onUnhandledRequest: 'error' fails any request to the debug API URL; the
  // body check covers the mocked production URL.
  await Sandbox.setPausedRetention(sandboxId, DAY_MS, {
    apiKey: TEST_API_KEY,
    debug: true,
  })

  expect(lastRetentionBody).toBeUndefined()
})

test('sandbox.setPausedRetention makes no request in debug mode', async () => {
  const sandbox = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    debug: true,
  })

  await sandbox.setPausedRetention(DAY_MS)
  await sandbox.setPausedRetention(null)

  expect(lastCreateBody).toBeUndefined()
  expect(lastRetentionBody).toBeUndefined()
})

test('setPausedRetention throws SandboxNotFoundError for an unknown sandbox', async () => {
  server.use(
    http.put(apiUrl(`/sandboxes/${sandboxId}/paused-retention`), () =>
      HttpResponse.json(
        { code: 404, message: 'sandbox not found' },
        { status: 404 }
      )
    )
  )

  await expect(
    Sandbox.setPausedRetention(sandboxId, DAY_MS, { apiKey: TEST_API_KEY })
  ).rejects.toThrowError(SandboxNotFoundError)
})

test('setPausedRetention throws SandboxNotFoundError for an empty-bodied 404', async () => {
  // openapi-fetch leaves `error` unset when a non-2xx response has no body.
  server.use(
    http.put(
      apiUrl(`/sandboxes/${sandboxId}/paused-retention`),
      () => new HttpResponse(null, { status: 404 })
    )
  )

  await expect(
    Sandbox.setPausedRetention(sandboxId, DAY_MS, { apiKey: TEST_API_KEY })
  ).rejects.toThrowError(SandboxNotFoundError)
})

test('setPausedRetention reports a sandbox changing state as a 409', async () => {
  server.use(
    http.put(apiUrl(`/sandboxes/${sandboxId}/paused-retention`), () =>
      HttpResponse.json(
        { code: 409, message: 'sandbox is pausing' },
        { status: 409 }
      )
    )
  )

  const err = await Sandbox.setPausedRetention(sandboxId, DAY_MS, {
    apiKey: TEST_API_KEY,
  }).catch((e) => e)

  expect(err).toBeInstanceOf(SandboxError)
  expect(err.statusCode).toBe(409)
})

function sandboxDetail(fields: Record<string, unknown>) {
  return {
    sandboxID: sandboxId,
    templateID: 'base',
    clientID: 'test-client',
    envdVersion: '0.2.4',
    startedAt: '2026-01-01T00:00:00Z',
    endAt: '2026-01-01T01:00:00Z',
    state: 'paused',
    cpuCount: 2,
    memoryMB: 512,
    diskSizeMB: 1024,
    lifecycle: { onTimeout: 'pause', autoResume: true },
    ...fields,
  }
}

test('getInfo reports the paused retention and when the paused sandbox expires', async () => {
  server.use(
    http.get(apiUrl(`/sandboxes/${sandboxId}`), () =>
      HttpResponse.json(
        sandboxDetail({
          pausedRetentionSeconds: 86_400,
          expiresAt: '2026-01-02T01:00:00Z',
        })
      )
    )
  )

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.lifecycle).toEqual({
    onTimeout: 'pause',
    autoResume: true,
    pausedRetentionMs: DAY_MS,
  })
  expect(info.pausedExpiresAt).toEqual(new Date('2026-01-02T01:00:00Z'))
})

test('getInfo leaves both unset when the sandbox has no paused retention', async () => {
  server.use(
    http.get(apiUrl(`/sandboxes/${sandboxId}`), () =>
      HttpResponse.json(
        sandboxDetail({ pausedRetentionSeconds: null, expiresAt: null })
      )
    )
  )

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.lifecycle).toEqual({ onTimeout: 'pause', autoResume: true })
  expect(info.pausedExpiresAt).toBeUndefined()
})

test('list reports when each paused sandbox expires', async () => {
  server.use(
    http.get(apiUrl('/v2/sandboxes'), () =>
      HttpResponse.json([
        sandboxDetail({
          pausedRetentionSeconds: 3600,
          expiresAt: '2026-01-01T02:00:00Z',
        }),
        sandboxDetail({
          sandboxID: 'running-sandbox-id',
          state: 'running',
          pausedRetentionSeconds: 3600,
          expiresAt: null,
        }),
      ])
    )
  )

  const sandboxes = await Sandbox.list({ apiKey: TEST_API_KEY }).nextItems()

  expect(sandboxes.map((s) => s.pausedExpiresAt)).toEqual([
    new Date('2026-01-01T02:00:00Z'),
    undefined,
  ])
})
