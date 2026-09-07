import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

let lastConnectBody: Record<string, unknown> | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes/:sandboxID/connect'), async ({ request }) => {
    lastConnectBody = (await request.json()) as Record<string, unknown>
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
  lastConnectBody = undefined
  server.resetHandlers()
})

test('Sandbox.connect omits memory when onResume is not given', async () => {
  await Sandbox.connect('test-sandbox-id', { apiKey: TEST_API_KEY })

  expect(lastConnectBody).toBeDefined()
  expect(lastConnectBody).not.toHaveProperty('memory')
})

test("Sandbox.connect omits memory for onResume: 'restore'", async () => {
  // 'restore' is the API's own default, so it must travel as an absent field
  // rather than memory: true — the two are not interchangeable on the wire.
  await Sandbox.connect('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    onResume: 'restore',
  })

  expect(lastConnectBody).not.toHaveProperty('memory')
})

test("Sandbox.connect sends memory: false for onResume: 'reboot'", async () => {
  await Sandbox.connect('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    onResume: 'reboot',
  })

  expect(lastConnectBody?.memory).toBe(false)
})

test('sandbox.connect carries onResume on the instance form too', async () => {
  const sandbox = await Sandbox.connect('test-sandbox-id', {
    apiKey: TEST_API_KEY,
  })
  lastConnectBody = undefined

  await sandbox.connect({ onResume: 'reboot' })
  expect(lastConnectBody?.memory).toBe(false)

  await sandbox.connect()
  expect(lastConnectBody).not.toHaveProperty('memory')
})

test('an untyped onResume value never sends memory: false', async () => {
  // Untyped callers can pass anything; only the 'reboot' literal opts into a
  // cold boot, so an unrecognized value must fall back to a memory restore.
  await Sandbox.connect('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    // @ts-expect-error 'Reboot' is not a valid onResume value
    onResume: 'Reboot',
  })

  expect(lastConnectBody).not.toHaveProperty('memory')
})
