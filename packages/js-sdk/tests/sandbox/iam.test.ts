import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox, Secret } from '../../src'
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

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))

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

test('Sandbox.create sends Secret.idToken tokens in the request body', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    iam: {
      tokens: {
        aws: Secret.idToken({
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
