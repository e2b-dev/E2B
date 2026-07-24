import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { InvalidArgumentError, Sandbox, Secret } from '../../src'
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

test('Sandbox.create sends iam tokens in the request body', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    iam: {
      tokens: {
        aws: { audience: 'sts.amazonaws.com', tokenType: 'JWT-SVID' },
      },
    },
  })

  expect(lastCreateBody?.iam).toEqual({
    tokens: {
      aws: { audience: 'sts.amazonaws.com', tokenType: 'JWT-SVID' },
    },
  })
})

test('Sandbox.create sends Secret.iamToken tokens in the request body', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    iam: {
      tokens: {
        aws: Secret.iamToken({
          audience: 'sts.amazonaws.com',
          tokenType: 'JWT-SVID',
        }),
      },
    },
  })

  expect(lastCreateBody?.iam).toEqual({
    tokens: {
      aws: { audience: 'sts.amazonaws.com', tokenType: 'JWT-SVID' },
    },
  })
})

test('Sandbox.create omits iam from the request body when not provided', async () => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('iam')
})

test('Sandbox.create omits an empty iam config from the request body', async () => {
  await Sandbox.create('base', { apiKey: TEST_API_KEY, iam: {} })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('iam')

  await Sandbox.create('base', { apiKey: TEST_API_KEY, iam: { tokens: {} } })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('iam')
})

test('Sandbox.create treats a tokens map with only undefined values as empty', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    iam: {
      // Untyped callers can build the map conditionally, leaving holes.
      tokens: { aws: undefined as never },
    },
  })

  expect(lastCreateBody).toBeDefined()
  expect(lastCreateBody).not.toHaveProperty('iam')
})

test('Sandbox.create strips unknown token properties from the request body', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    iam: {
      tokens: {
        aws: {
          audience: 'sts.amazonaws.com',
          tokenType: 'JWT-SVID',
          filePath: '/run/token',
        } as never,
      },
    },
  })

  expect(lastCreateBody?.iam).toEqual({
    tokens: {
      aws: { audience: 'sts.amazonaws.com', tokenType: 'JWT-SVID' },
    },
  })
})

test('Sandbox.create rejects a token missing audience or tokenType', async () => {
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      iam: {
        // The wire-format casing an untyped caller might copy from a payload.
        tokens: { aws: { audience: 'sts.amazonaws.com' } as never },
      },
    })
  ).rejects.toThrowError(InvalidArgumentError)
})
