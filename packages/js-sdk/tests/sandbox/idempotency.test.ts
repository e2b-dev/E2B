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

test('Sandbox.create rejects idempotency keys outside 1-255 characters before a request', async () => {
  const emptyKey = Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    idempotencyKey: '',
  })
  await expect(emptyKey).rejects.toThrow(InvalidArgumentError)
  await expect(emptyKey).rejects.toThrow(
    'Invalid idempotencyKey: expected 1-255 characters, got 0.'
  )

  const longKey = Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    idempotencyKey: 'a'.repeat(256),
  })
  await expect(longKey).rejects.toThrow(InvalidArgumentError)
  await expect(longKey).rejects.toThrow(
    'Invalid idempotencyKey: expected 1-255 characters, got 256.'
  )

  expect(idempotencyKeys).toEqual([])
})

test.each(['ABC', 'abc_1', ' abc ', '界'])(
  'Sandbox.create rejects invalid idempotency key characters before a request: %s',
  async (key) => {
    await expect(
      Sandbox.create('base', { apiKey: TEST_API_KEY, idempotencyKey: key })
    ).rejects.toThrow(
      'Invalid idempotencyKey: only lowercase letters, digits and hyphens are allowed.'
    )

    expect(idempotencyKeys).toEqual([])
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

test('E2B rejects a client-bound idempotency key', () => {
  const createClientWithKey = () =>
    new E2B({
      apiKey: TEST_API_KEY,
      idempotencyKey: 'bound123',
    } as any)

  expect(createClientWithKey).toThrow(InvalidArgumentError)
  expect(createClientWithKey).toThrow(
    'idempotencyKey is per sandbox create; pass it to Sandbox.create instead of the E2B client.'
  )
})

test('client.Sandbox.create accepts a per-call idempotency key', async () => {
  const client = new E2B({ apiKey: TEST_API_KEY })

  await client.Sandbox.create('base', { idempotencyKey: 'abc123' })
  await client.Sandbox.create('base')

  expect(idempotencyKeys).toEqual(['abc123', null])
})
