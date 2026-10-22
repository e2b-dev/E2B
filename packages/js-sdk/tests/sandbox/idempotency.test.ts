import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'

import { E2B, Sandbox } from '../../src'
import { ConnectionConfig } from '../../src/connectionConfig'
import { InvalidArgumentError } from '../../src/errors'
import { TEST_API_KEY, apiUrl } from '../setup'
import { setupMockApi } from '../mockApi'

const idempotencyKeys: (string | null)[] = []

const server = setupMockApi(
  http.post(apiUrl('/v2/sandboxes'), ({ request }) => {
    idempotencyKeys.push(request.headers.get('Idempotency-Key'))
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

test('Sandbox.create sends the configured idempotency key', async () => {
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

test('ConnectionConfig accepts a 255-character idempotency key', () => {
  const key = 'a'.repeat(255)

  expect(new ConnectionConfig({ idempotencyKey: key }).idempotencyKey).toBe(key)
})

test('ConnectionConfig accepts a lowercase UUID idempotency key', () => {
  const key = '123e4567-e89b-12d3-a456-426614174000'

  expect(new ConnectionConfig({ idempotencyKey: key }).idempotencyKey).toBe(key)
})

test('ConnectionConfig rejects idempotency keys outside 1-255 characters', () => {
  const emptyKey = () => new ConnectionConfig({ idempotencyKey: '' })
  const longKey = () =>
    new ConnectionConfig({ idempotencyKey: 'a'.repeat(256) })

  expect(emptyKey).toThrow(InvalidArgumentError)
  expect(emptyKey).toThrow(
    'Invalid idempotencyKey: expected 1-255 characters, got 0.'
  )
  expect(longKey).toThrow(InvalidArgumentError)
  expect(longKey).toThrow(
    'Invalid idempotencyKey: expected 1-255 characters, got 256.'
  )
})

test.each(['ABC', 'abc_1', ' abc ', '界'])(
  'ConnectionConfig rejects invalid idempotency key characters: %s',
  (key) => {
    expect(() => new ConnectionConfig({ idempotencyKey: key })).toThrow(
      'Invalid idempotencyKey: only lowercase letters, digits and hyphens are allowed.'
    )
  }
)

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
