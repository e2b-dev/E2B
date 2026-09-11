import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { InvalidArgumentError, Sandbox, SandboxError } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

const sandboxId = 'test-sandbox-id'

const redisInfo = {
  entry: 'redis',
  version: '7.4.1',
  role: 'service',
  class: 'stateful',
  state: 'running',
  name: 'redis.sidecar.e2b.local',
  address: '169.254.0.25',
  ports: [6379],
}

const failedProxyInfo = {
  entry: 'iron-proxy',
  version: '0.4.1',
  role: 'proxy',
  class: 'stateful',
  state: 'failed',
  name: 'iron-proxy.sidecar.e2b.local',
  lastError: 'readiness probe timed out',
}

const sandboxDetail = {
  sandboxID: sandboxId,
  templateID: 'base',
  clientID: 'test-client',
  envdVersion: '0.2.4',
  startedAt: '2026-01-01T00:00:00Z',
  endAt: '2026-01-01T01:00:00Z',
  state: 'running',
  cpuCount: 2,
  memoryMB: 512,
  diskSizeMB: 1024,
}

let lastCreateBody: Record<string, any> | undefined
let createResponse: () => HttpResponse
let infoSidecars: unknown[] | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, any>
    return createResponse()
  }),
  http.get(apiUrl(`/sandboxes/${sandboxId}`), () =>
    HttpResponse.json({ ...sandboxDetail, sidecars: infoSidecars })
  ),
  http.get(apiUrl('/v2/sandboxes'), () =>
    HttpResponse.json([{ ...sandboxDetail, sidecars: infoSidecars }])
  ),
  http.put(apiUrl(`/sandboxes/${sandboxId}/network`), () =>
    HttpResponse.json(
      {
        code: 400,
        error_code: 'sidecar_rule_collision',
        message: 'api.openai.com is routed through the iron-proxy sidecar',
      },
      { status: 400 }
    )
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  infoSidecars = undefined
  createResponse = () =>
    HttpResponse.json({
      sandboxID: sandboxId,
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  server.resetHandlers()
})

createResponse = () =>
  HttpResponse.json({
    sandboxID: sandboxId,
    templateID: 'base',
    envdVersion: '0.2.4',
  })

test('Sandbox.create sends the sidecars in the request body', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [
      { entry: 'redis' },
      {
        entry: 'iron-proxy',
        version: '0.4.1',
        config: { allow: ['api.openai.com'] },
        secrets: { upstream: '${e2b.secrets.openai-key}' },
      },
    ],
  })

  expect(lastCreateBody?.sidecars).toEqual([
    { entry: 'redis' },
    {
      entry: 'iron-proxy',
      version: '0.4.1',
      config: { allow: ['api.openai.com'] },
      secrets: { upstream: '${e2b.secrets.openai-key}' },
    },
  ])
})

test.each([
  ['not provided', {}],
  ['an empty list', { sidecars: [] }],
  ['null', { sidecars: null as any }],
])('Sandbox.create omits sidecars when %s', async (_, opts) => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY, ...opts })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('sidecars')
})

test('Sandbox.create strips unknown sidecar properties', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [
      // An untyped caller can copy an extra key out of a config file; the
      // API rejects unknown properties.
      { entry: 'redis', image: 'redis:7' } as any,
    ],
  })

  expect(lastCreateBody?.sidecars).toEqual([{ entry: 'redis' }])
})

test('Sandbox.create rejects a sidecar without an entry before any request', async () => {
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      sidecars: [{ version: '7.4.1' } as any],
    })
  ).rejects.toThrowError(InvalidArgumentError)

  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      sidecars: { entry: 'redis' } as any,
    })
  ).rejects.toThrowError(InvalidArgumentError)

  expect(lastCreateBody).toBeUndefined()
})

test('Sandbox.getInfo returns the sidecars with their state', async () => {
  infoSidecars = [redisInfo, failedProxyInfo]

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.sidecars).toEqual([redisInfo, failedProxyInfo])
})

test('Sandbox.getInfo passes through a state value the SDK does not know', async () => {
  infoSidecars = [{ ...redisInfo, state: 'restarting' }]

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.sidecars?.[0].state).toBe('restarting')
})

test('Sandbox.getInfo returns an empty sidecar list when the API sends none', async () => {
  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.sidecars).toEqual([])
})

test('Sandbox.list returns the sidecars of each sandbox', async () => {
  infoSidecars = [redisInfo]

  const [info] = await Sandbox.list({ apiKey: TEST_API_KEY }).nextItems()

  expect(info.sidecars).toEqual([redisInfo])
})

test('a sidecar_* 400 surfaces as InvalidArgumentError with the code preserved', async () => {
  createResponse = () =>
    HttpResponse.json(
      {
        code: 400,
        error_code: 'sidecar_unknown_entry',
        message: 'unknown sidecar entry "memcached"',
      },
      { status: 400 }
    )

  const err = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [{ entry: 'memcached' }],
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(InvalidArgumentError)
  expect((err as SandboxError).statusCode).toBe(400)
  expect((err as Error).message).toContain('sidecar_unknown_entry')
  expect((err as Error).message).toContain('memcached')
})

test('sidecar_failed keeps the entry name and is not an argument error', async () => {
  createResponse = () =>
    HttpResponse.json(
      {
        code: 500,
        error_code: 'sidecar_failed',
        message: 'sidecar "redis" failed to become ready',
      },
      { status: 500 }
    )

  const err = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [{ entry: 'redis' }],
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(SandboxError)
  expect(err).not.toBeInstanceOf(InvalidArgumentError)
  expect((err as SandboxError).statusCode).toBe(500)
  expect((err as Error).message).toContain('sidecar_failed')
  expect((err as Error).message).toContain('redis')
})

test.each([
  'sidecar_unknown_entry',
  'sidecar_deprecated_entry',
  'sidecar_limit',
  'sidecar_one_proxy',
  'sidecar_config_invalid',
  'sidecar_secret_missing',
  'sidecar_rule_collision',
  'sidecar_egress_conflict',
  'sidecar_flag_off',
])('every 400 sidecar code (%s) is an InvalidArgumentError', async (code) => {
  createResponse = () =>
    HttpResponse.json(
      { code: 400, error_code: code, message: 'rejected' },
      {
        status: 400,
      }
    )

  const err = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [{ entry: 'redis' }],
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toBe(`${code}: rejected`)
})

test('the sidecar code match is case-sensitive', async () => {
  createResponse = () =>
    HttpResponse.json(
      { code: 400, error_code: 'SIDECAR_UNKNOWN_ENTRY', message: 'nope' },
      { status: 400 }
    )

  const err = await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    sidecars: [{ entry: 'memcached' }],
  }).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(SandboxError)
  expect(err).not.toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toBe('400: nope')
})

test('a 400 without a sidecar code keeps the generic mapping', async () => {
  createResponse = () =>
    HttpResponse.json(
      { code: 400, message: 'invalid template' },
      { status: 400 }
    )

  const err = await Sandbox.create('base', { apiKey: TEST_API_KEY }).catch(
    (e: unknown) => e
  )

  expect(err).toBeInstanceOf(SandboxError)
  expect(err).not.toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toBe('400: invalid template')
})

test('Sandbox.updateNetwork surfaces sidecar_rule_collision as InvalidArgumentError', async () => {
  const err = await Sandbox.updateNetwork(
    sandboxId,
    { allowOut: ['api.openai.com'] },
    { apiKey: TEST_API_KEY }
  ).catch((e: unknown) => e)

  expect(err).toBeInstanceOf(InvalidArgumentError)
  expect((err as Error).message).toContain('sidecar_rule_collision')
})
