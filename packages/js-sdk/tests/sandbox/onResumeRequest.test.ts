import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { InvalidArgumentError, Sandbox } from '../../src'
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

test('a nullish onResume is treated as absent', async () => {
  await Sandbox.connect('test-sandbox-id', {
    apiKey: TEST_API_KEY,
    // @ts-expect-error null is not a valid onResume value
    onResume: null,
  })

  expect(lastConnectBody).not.toHaveProperty('memory')
})

// The option is resolved into a boolean before the request is built, so the API
// never sees it and cannot reject a typo. Falling back to a restore would
// silently skip the reboot the caller asked for.
const unrecognized = [
  'Reboot',
  'REBOOT',
  'reboot\n',
  ' reboot',
  'rebooted',
  false,
  0,
]

test.for(unrecognized)(
  'an unrecognized onResume %o is rejected',
  async (value) => {
    await expect(
      Sandbox.connect('test-sandbox-id', {
        apiKey: TEST_API_KEY,
        // @ts-expect-error deliberately outside the union
        onResume: value,
      })
    ).rejects.toThrowError(InvalidArgumentError)

    expect(lastConnectBody).toBeUndefined()
  }
)

test('an unrecognized onResume is InvalidArgumentError without an API key', async () => {
  const previous = process.env.E2B_API_KEY
  delete process.env.E2B_API_KEY
  try {
    await expect(
      Sandbox.connect('test-sandbox-id', {
        // @ts-expect-error deliberately outside the union
        onResume: 'Reboot',
      })
    ).rejects.toThrowError(InvalidArgumentError)
  } finally {
    if (previous === undefined) {
      delete process.env.E2B_API_KEY
    } else {
      process.env.E2B_API_KEY = previous
    }
  }
  expect(lastConnectBody).toBeUndefined()
})
