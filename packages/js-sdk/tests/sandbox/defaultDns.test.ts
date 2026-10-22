import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import { Sandbox } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

const sandboxId = 'test-sandbox-id'

let lastCreateBody: Record<string, any> | undefined
let lastUpdateBody: Record<string, any> | undefined
let sandboxNetwork: Record<string, any> | undefined

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, any>
    return HttpResponse.json({
      sandboxID: sandboxId,
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  }),
  http.put(apiUrl(`/sandboxes/${sandboxId}/network`), async ({ request }) => {
    lastUpdateBody = (await request.json()) as Record<string, any>
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(apiUrl(`/sandboxes/${sandboxId}`), () =>
    HttpResponse.json({
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
      network: sandboxNetwork,
    })
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  lastUpdateBody = undefined
  sandboxNetwork = undefined
  server.resetHandlers()
})

test.for([false, true])(
  'Sandbox.create sends allowDefaultDns: %s',
  async (allowDefaultDns) => {
    await Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      network: {
        allowOut: ['api.example.com'],
        denyOut: ({ allTraffic }) => [allTraffic],
        allowDefaultDns,
      },
    })

    expect(lastCreateBody?.network).toEqual({
      allowOut: ['api.example.com'],
      denyOut: ['0.0.0.0/0'],
      allowDefaultDns,
    })
  }
)

test('Sandbox.create omits allowDefaultDns when not provided', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: { allowOut: ['api.example.com'] },
  })

  expect(lastCreateBody?.network).toBeDefined()
  expect(lastCreateBody?.network).not.toHaveProperty('allowDefaultDns')
})

test.for([false, true])(
  'updateNetwork sends allowDefaultDns: %s',
  async (allowDefaultDns) => {
    await Sandbox.updateNetwork(
      sandboxId,
      { allowOut: ['api.example.com'], allowDefaultDns },
      { apiKey: TEST_API_KEY }
    )

    expect(lastUpdateBody).toEqual({
      allowOut: ['api.example.com'],
      allowDefaultDns,
    })
  }
)

test('updateNetwork omits allowDefaultDns when not provided', async () => {
  await Sandbox.updateNetwork(
    sandboxId,
    { allowOut: ['api.example.com'] },
    { apiKey: TEST_API_KEY }
  )

  expect(lastUpdateBody).toEqual({ allowOut: ['api.example.com'] })
})

test('a null allowDefaultDns is treated as not set', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: { allowOut: ['api.example.com'], allowDefaultDns: null as any },
  })
  expect(lastCreateBody?.network).not.toHaveProperty('allowDefaultDns')

  await Sandbox.updateNetwork(
    sandboxId,
    { allowOut: ['api.example.com'], allowDefaultDns: null as any },
    { apiKey: TEST_API_KEY }
  )
  expect(lastUpdateBody).toEqual({ allowOut: ['api.example.com'] })
})

test('getInfo reports allowDefaultDns', async () => {
  sandboxNetwork = { allowOut: ['api.example.com'], allowDefaultDns: false }

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.network?.allowDefaultDns).toBe(false)
})

test('getInfo leaves allowDefaultDns unset when the API omits it', async () => {
  sandboxNetwork = { allowOut: ['api.example.com'] }

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.network?.allowDefaultDns).toBeUndefined()
})
