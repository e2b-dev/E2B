import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox } from '../../src'
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

test('Sandbox.create omits autoResume when lifecycle.autoResume is not provided', async () => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('autoResume')
})

test('Sandbox.create sends autoResume false when explicitly disabled', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { autoResume: false },
  })

  expect(lastCreateBody?.autoResume).toEqual({ enabled: false })
})

test('Sandbox.create sends autoResume true when explicitly enabled', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    lifecycle: { onTimeout: 'pause', autoResume: true },
  })

  expect(lastCreateBody?.autoResume).toEqual({ enabled: true })
})
