import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { InvalidArgumentError, Sandbox, Secret } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

const sandboxId = 'test-sandbox-id'

let lastCreateBody: Record<string, any> | undefined
let lastUpdateBody: Record<string, any> | undefined

const server = setupServer(
  http.post(apiUrl('/sandboxes'), async ({ request }) => {
    lastCreateBody = (await request.json()) as Record<string, any>
    return HttpResponse.json({
      sandboxID: sandboxId,
      templateID: 'base',
      envdVersion: '0.2.4',
    })
  }),
  http.put(apiUrl(`/sandboxes/${sandboxId}/network`), async ({ request }) => {
    lastUpdateBody = (await request.json()) as Record<string, any>
    return new HttpResponse(null, { status: 204 })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  lastUpdateBody = undefined
  server.resetHandlers()
})

const awsToken = Secret.iamToken({
  audience: 'sts.amazonaws.com',
  tokenType: 'JWT-SVID',
})

test('transform callback resolves an iam token to its placeholder', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    iam: { tokens: { aws: awsToken } },
    network: {
      allowOut: ({ rules }) => [...rules.keys()],
      rules: {
        'api.internal.example.com': [
          {
            transform: ({ iam }) => ({
              headers: { Authorization: `Bearer ${iam.tokens.aws}` },
            }),
          },
        ],
      },
    },
  })

  expect(lastCreateBody?.network).toEqual({
    allowOut: ['api.internal.example.com'],
    rules: {
      'api.internal.example.com': [
        {
          transform: {
            headers: {
              // The SDK never resolves the placeholder — the egress proxy
              // substitutes a freshly minted token per request.
              Authorization: 'Bearer ${e2b.identity.tokens.aws}',
            },
          },
        },
      ],
    },
  })
})

test('transform callback sees every registered iam token', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    iam: { tokens: { aws: awsToken, gcp: awsToken } },
    network: {
      rules: {
        'api.internal.example.com': [
          {
            transform: ({ iam }) => ({
              headers: { 'X-Tokens': Object.keys(iam.tokens).join(',') },
            }),
          },
        ],
      },
    },
  })

  expect(
    lastCreateBody?.network.rules['api.internal.example.com'][0].transform
      .headers
  ).toEqual({ 'X-Tokens': 'aws,gcp' })
})

test('a static transform is still sent unchanged', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: {
      rules: {
        'api.openai.com': [
          { transform: { headers: { Authorization: 'Bearer static' } } },
        ],
      },
    },
  })

  expect(lastCreateBody?.network.rules).toEqual({
    'api.openai.com': [
      { transform: { headers: { Authorization: 'Bearer static' } } },
    ],
  })
})

test('transform callback rejects an unregistered iam token', async () => {
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      iam: { tokens: { aws: awsToken } },
      network: {
        rules: {
          'api.internal.example.com': [
            {
              transform: ({ iam }) => ({
                headers: { Authorization: `Bearer ${iam.tokens.awz}` },
              }),
            },
          ],
        },
      },
    })
  ).rejects.toThrowError(/iam token 'awz'.*Registered tokens: 'aws'/s)

  expect(lastCreateBody).toBeUndefined()
})

test('transform callback rejects an iam token when no iam config is set', async () => {
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      network: {
        rules: {
          'api.internal.example.com': [
            {
              transform: ({ iam }) => ({
                headers: { Authorization: `Bearer ${iam.tokens.aws}` },
              }),
            },
          ],
        },
      },
    })
  ).rejects.toThrowError(InvalidArgumentError)

  expect(lastCreateBody).toBeUndefined()
})

test('transform callback that returns nothing is rejected', async () => {
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      network: {
        rules: {
          'api.internal.example.com': [
            // Untyped callers can forget the return value; the rule would
            // otherwise be created without the headers it exists for.
            { transform: (() => undefined) as never },
          ],
        },
      },
    })
  ).rejects.toThrowError(InvalidArgumentError)

  expect(lastCreateBody).toBeUndefined()
})

test('updateNetwork resolves transform callbacks without an iam config', async () => {
  // The update payload carries no iam config, so the sandbox's registered token
  // names are unknown client-side and any name resolves to its placeholder.
  await Sandbox.updateNetwork(
    sandboxId,
    {
      allowOut: ({ rules }) => [...rules.keys()],
      rules: {
        'api.internal.example.com': [
          {
            transform: ({ iam }) => ({
              headers: { Authorization: `Bearer ${iam.tokens.aws}` },
            }),
          },
        ],
      },
    },
    { apiKey: TEST_API_KEY }
  )

  expect(lastUpdateBody).toEqual({
    allowOut: ['api.internal.example.com'],
    rules: {
      'api.internal.example.com': [
        {
          transform: {
            headers: { Authorization: 'Bearer ${e2b.identity.tokens.aws}' },
          },
        },
      ],
    },
  })
})
