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
              headers: {
                'X-Tokens': Object.keys(iam.tokens).join(','),
                // Membership answers "is it registered?" without throwing, so a
                // callback can branch on it.
                'X-Has-Aws': String('aws' in iam.tokens),
                'X-Has-Gh': String('gh' in iam.tokens),
                // Membership must agree with a lookup: an inherited object
                // member is not a registered token either.
                'X-Has-Ctor': String('constructor' in iam.tokens),
                // Serializing the context must not trip the unknown-token guard
                // on the runtime's `toJSON` probe.
                'X-Json': JSON.stringify(iam.tokens),
              },
            }),
          },
        ],
      },
    },
  })

  expect(
    lastCreateBody?.network.rules['api.internal.example.com'][0].transform
      .headers
  ).toEqual({
    'X-Tokens': 'aws,gcp',
    'X-Has-Aws': 'true',
    'X-Has-Gh': 'false',
    'X-Has-Ctor': 'false',
    'X-Json': JSON.stringify({
      aws: '${e2b.identity.tokens.aws}',
      gcp: '${e2b.identity.tokens.gcp}',
    }),
  })
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

test.for(['constructor', '__proto__', 'hasOwnProperty'])(
  'transform callback rejects an unregistered iam token named %s',
  async (name: string) => {
    // Inherited Object.prototype members are not registered tokens; resolving
    // them would put a built-in function in the header. Python's mapping treats
    // them as missing too.
    await expect(
      Sandbox.create('base', {
        apiKey: TEST_API_KEY,
        iam: { tokens: { aws: awsToken } },
        network: {
          rules: {
            'api.internal.example.com': [
              {
                transform: ({ iam }) => ({
                  headers: { Authorization: `Bearer ${iam.tokens[name]}` },
                }),
              },
            ],
          },
        },
      })
    ).rejects.toThrowError(`iam token '${name}', which is not registered`)

    expect(lastCreateBody).toBeUndefined()
  }
)

test.for(['then', 'toJSON', 'toString', 'valueOf'])(
  'transform callback rejects runtime-probed iam token name %s',
  async (name: string) => {
    // `then`, `toJSON`, `toString` and `valueOf` are properties the language
    // runtime probes when it serializes or coerces an object. A reference to an
    // unregistered token by one of those names must still be reported like any
    // other missing token instead of silently returning a built-in (issue #1673).
    await expect(
      Sandbox.create('base', {
        apiKey: TEST_API_KEY,
        iam: { tokens: { aws: awsToken } },
        network: {
          rules: {
            'api.internal.example.com': [
              {
                transform: ({ iam }) => ({
                  headers: { Authorization: `Bearer ${iam.tokens[name]}` },
                }),
              },
            ],
          },
        },
      })
    ).rejects.toThrowError(`iam token '${name}', which is not registered`)

    expect(lastCreateBody).toBeUndefined()
  }
)

test('transform callback can still serialize and stringify registered iam tokens', async () => {
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      iam: { tokens: { aws: awsToken } },
      network: {
        rules: {
          'api.internal.example.com': [
            {
              transform: ({ iam }) => ({
                'X-Json': JSON.stringify(iam.tokens),
                'X-String': String(iam.tokens),
              }),
            },
          ],
        },
      },
    })
  ).resolves.toBeDefined()

  expect(lastCreateBody).toBeDefined()
})

test('transform callback keeps a registered token named after a runtime prop', async () => {
  // A workload can register a token literally named `toJSON`, `toString` or
  // `valueOf`. The runtime-guard methods must not shadow such a registered
  // token: it has to resolve to its placeholder and stay enumerable.
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      iam: { tokens: { toString: awsToken } },
      network: {
        rules: {
          'api.internal.example.com': [
            {
              transform: ({ iam }) => ({
                'X-Placeholder': iam.tokens.toString,
                'X-Keys': Object.keys(iam.tokens).join(','),
              }),
            },
          ],
        },
      },
    })
  ).resolves.toBeDefined()

  const transform =
    lastCreateBody?.network?.rules?.['api.internal.example.com']?.[0]?.transform
  expect(transform?.['X-Placeholder']).toBe('${e2b.identity.tokens.toString}')
  expect(transform?.['X-Keys']).toBe('toString')
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

test.for([
  ['undefined', () => undefined],
  ['string', () => 'headers'],
  ['array', () => [{ headers: {} }]],
  ['Map', () => new Map([['headers', {}]])],
])(
  'transform callback returning a %s is rejected',
  async ([, transform]: [string, () => unknown]) => {
    // Untyped callers can forget the return value or return the wrong shape; the
    // rule would otherwise be created without the headers it exists for.
    await expect(
      Sandbox.create('base', {
        apiKey: TEST_API_KEY,
        network: {
          rules: {
            'api.internal.example.com': [{ transform: transform as never }],
          },
        },
      })
    ).rejects.toThrowError(
      /must return a transform object, got (undefined|string|array|Map)/
    )

    expect(lastCreateBody).toBeUndefined()
  }
)

test('async transform callback is rejected', async () => {
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      network: {
        rules: {
          'api.internal.example.com': [
            {
              transform: (async () => ({
                headers: { Authorization: 'Bearer late' },
              })) as never,
            },
          ],
        },
      },
    })
  ).rejects.toThrowError(/must be synchronous/)

  expect(lastCreateBody).toBeUndefined()
})

test('an explicit null transform sends an empty rule', async () => {
  // Rules built from parsed JSON spell "no transform" as null; Python treats it
  // the same way.
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: {
      rules: { 'api.internal.example.com': [{ transform: null as never }] },
    },
  })

  expect(lastCreateBody?.network.rules).toEqual({
    'api.internal.example.com': [{}],
  })
})

test.for([
  ['a}b', 'closing brace'],
  ['a{b', 'opening brace'],
  ['aws}${e2b.identity.tokens.gcp', 'smuggled placeholder'],
  ['a\nb', 'control character'],
  ['', 'empty'],
])(
  'an iam token name with a %s is rejected',
  async ([name]: [string, string]) => {
    // The proxy reads a placeholder up to its first `}`, so a brace in the name
    // resolves a different token than the one referenced — 'a}b' would mint 'a'
    // and leave 'b}' as literal text.
    await expect(
      Sandbox.create('base', {
        apiKey: TEST_API_KEY,
        iam: { tokens: { [name]: awsToken } },
      })
    ).rejects.toThrowError(/is not usable/)

    expect(lastCreateBody).toBeUndefined()

    // The update path takes any name from the callback, so it has to check again
    // at the point of interpolation.
    await expect(
      Sandbox.updateNetwork(
        sandboxId,
        {
          rules: {
            'api.internal.example.com': [
              {
                transform: ({ iam }) => ({
                  headers: { Authorization: `Bearer ${iam.tokens[name]}` },
                }),
              },
            ],
          },
        },
        { apiKey: TEST_API_KEY }
      )
    ).rejects.toThrowError(/is not usable/)

    expect(lastUpdateBody).toBeUndefined()
  }
)

test('an ordinary iam token name is accepted', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    iam: { tokens: { 'aws.prod-1_x': awsToken } },
    network: {
      rules: {
        'api.internal.example.com': [
          {
            transform: ({ iam }) => ({
              headers: {
                Authorization: `Bearer ${iam.tokens['aws.prod-1_x']}`,
              },
            }),
          },
        ],
      },
    },
  })

  expect(
    lastCreateBody?.network.rules['api.internal.example.com'][0].transform
      .headers
  ).toEqual({
    Authorization: 'Bearer ${e2b.identity.tokens.aws.prod-1_x}',
  })
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
