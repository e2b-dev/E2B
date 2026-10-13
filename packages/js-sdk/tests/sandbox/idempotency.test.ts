import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import { Sandbox } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

const idempotencyKeys: string[] = []

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), ({ request }) => {
    idempotencyKeys.push(request.headers.get('Idempotency-Key') ?? '')
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
  idempotencyKeys.length = 0
  server.resetHandlers()
})

test('Sandbox.create sends a distinct 32-character idempotency key per call', async () => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY })
  await Sandbox.create('base', { apiKey: TEST_API_KEY })

  expect(idempotencyKeys).toHaveLength(2)
  expect(idempotencyKeys.every((key) => /^[a-z0-9]{32}$/.test(key))).toBe(true)
  expect(new Set(idempotencyKeys).size).toBe(2)
})
