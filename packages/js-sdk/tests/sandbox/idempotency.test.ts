import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import { E2B, Sandbox } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { InvalidArgumentError } from '../../src/errors'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

const idempotencyKeys: (string | null)[] = []
const listIdempotencyKeys: (string | null)[] = []

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), ({ request }) => {
    idempotencyKeys.push(request.headers.get('Idempotency-Key'))
    return HttpResponse.json({
      sandboxID: 'test-sandbox-id',
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  }),
  http.get(apiUrl('/v2/sandboxes'), ({ request }) => {
    listIdempotencyKeys.push(request.headers.get('Idempotency-Key'))
    return HttpResponse.json([])
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  idempotencyKeys.length = 0
  listIdempotencyKeys.length = 0
  server.resetHandlers()
})

test('Sandbox.create sends the idempotency key', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    idempotencyKey: 'abc123',
  })

  expect(idempotencyKeys).toEqual(['abc123'])
})

test('Sandbox.create does not send an idempotency key when unset', async () => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY })

  expect(idempotencyKeys).toEqual([null])
})

test('Sandbox.create sends a 255-character idempotency key', async () => {
  const key = 'a'.repeat(255)

  await Sandbox.create('base', { apiKey: TEST_API_KEY, idempotencyKey: key })

  expect(idempotencyKeys).toEqual([key])
})

test('Sandbox.create sends a lowercase UUID idempotency key', async () => {
  const key = '123e4567-e89b-12d3-a456-426614174000'

  await Sandbox.create('base', { apiKey: TEST_API_KEY, idempotencyKey: key })

  expect(idempotencyKeys).toEqual([key])
})

test.each(['', ' abc ', 'abc ', '界', 'a\nb'])(
  'Sandbox.create rejects an idempotency key the API would not see as given: %j',
  async (key) => {
    const created = Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      idempotencyKey: key,
    })

    await expect(created).rejects.toThrow(InvalidArgumentError)
    await expect(created).rejects.toThrow(
      'Invalid idempotencyKey: expected a non-empty string of printable ASCII characters that does not start or end with a space.'
    )
    expect(idempotencyKeys).toEqual([])
  }
)

// Which keys are accepted is the API's rule, so they are sent for it to judge.
test.each(['ABC', 'abc_1', 'a'.repeat(256)])(
  'Sandbox.create sends an idempotency key for the API to check: %s',
  async (key) => {
    await Sandbox.create('base', { apiKey: TEST_API_KEY, idempotencyKey: key })

    expect(idempotencyKeys).toEqual([key])
  }
)

test('ConnectionConfig ignores an untyped idempotency key', () => {
  const config = new ConnectionConfig({ idempotencyKey: 'x' } as any)

  expect(config.headers).not.toHaveProperty('Idempotency-Key')
})

test('Sandbox.list ignores an untyped idempotency key', async () => {
  await Sandbox.list({
    apiKey: TEST_API_KEY,
    idempotencyKey: 'x',
  } as any).nextItems()

  expect(listIdempotencyKeys).toEqual([null])
})

test('client.Sandbox.create accepts a per-call idempotency key', async () => {
  const client = new E2B({ apiKey: TEST_API_KEY })

  await client.Sandbox.create('base', { idempotencyKey: 'abc123' })
  await client.Sandbox.create('base')

  expect(idempotencyKeys).toEqual(['abc123', null])
})
