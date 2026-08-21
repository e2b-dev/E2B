import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

let lastCreateBody: Record<string, unknown> | undefined
let lastForkBody: Record<string, unknown> | undefined
let lastPauseBody: Record<string, unknown> | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, unknown>
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
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  lastForkBody = undefined
  lastPauseBody = undefined
  server.resetHandlers()
})

test('Sandbox.create omits timeout, secure and allow_internet_access when unset', async () => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('timeout')
  expect(lastCreateBody).not.toHaveProperty('secure')
  expect(lastCreateBody).not.toHaveProperty('allow_internet_access')
})

test('Sandbox.create sends explicit timeout, secure and allow_internet_access', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    timeoutMs: 60_000,
    secure: false,
    allowInternetAccess: false,
  })

  expect(lastCreateBody?.timeout).toBe(60)
  expect(lastCreateBody?.secure).toBe(false)
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

test('Sandbox.pause omits memory when keepMemory is unset', async () => {
  await Sandbox.pause('test-sandbox-id', { apiKey: TEST_API_KEY })

  expect(lastPauseBody).toBeDefined()
  expect(lastPauseBody).not.toHaveProperty('memory')
})

test('Sandbox.pause sends an explicit keepMemory', async () => {
  await Sandbox.pause('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    keepMemory: false,
  })

  expect(lastPauseBody?.memory).toBe(false)
})
