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

test.for(['toJSON', 'then', 'toString', 'valueOf'])(
  'transform callback rejects an unregistered iam token named %s, which the runtime also probes',
  async (name: string) => {
    // The runtime reads these four off anything it serializes, awaits or
    // coerces, so they used to be exempt from the guard — and an unregistered
    // one serialized as `Bearer undefined` or as the source of a built-in
    // instead of being reported. The runtime is served elsewhere now, so as a
    // token name they are as unregistered as any other.
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

test.for([
  [
    'assignment',
    ({ iam }: any) => {
      iam.tokens.gcp = '${e2b.identity.tokens.gcp}'
      return { headers: { Authorization: `Bearer ${iam.tokens.gcp}` } }
    },
  ],
  [
    'Object.defineProperty',
    ({ iam }: any) => {
      Object.defineProperty(iam.tokens, 'gcp', { value: 'smuggled' })
      return { headers: { Authorization: `Bearer ${iam.tokens.gcp}` } }
    },
  ],
  [
    'delete',
    ({ iam }: any) => {
      delete iam.tokens.aws
      return { headers: { Authorization: `Bearer ${iam.tokens.aws}` } }
    },
  ],
])(
  'transform callback cannot mutate iam.tokens by %s',
  async ([, transform]: [string, (ctx: any) => unknown]) => {
    // Writing a name the API was never told about mints a placeholder the egress
    // proxy cannot resolve: it drops the header and forwards the request anyway,
    // which is the silent failure the guard exists to prevent. Deleting one
    // would make the "Registered tokens" hint contradict itself.
    await expect(
      Sandbox.create('base', {
        apiKey: TEST_API_KEY,
        iam: { tokens: { aws: awsToken } },
        network: {
          rules: {
            'api.internal.example.com': [{ transform: transform as never }],
          },
        },
      })
    ).rejects.toThrowError(/iam\.tokens is read-only/)

    expect(lastCreateBody).toBeUndefined()
  }
)

test('transform callback rejects an unregistered iam token read by descriptor', async () => {
  // `getOwnPropertyDescriptor(...)?.value` is a lookup too: it used to answer
  // `undefined` for an unregistered name and put that on the wire.
  await expect(
    Sandbox.create('base', {
      apiKey: TEST_API_KEY,
      iam: { tokens: { aws: awsToken } },
      network: {
        rules: {
          'api.internal.example.com': [
            {
              transform: ({ iam }) => ({
                headers: {
                  Authorization: `Bearer ${
                    Object.getOwnPropertyDescriptor(iam.tokens, 'gcp')?.value
                  }`,
                },
              }),
            },
          ],
        },
      },
    })
  ).rejects.toThrowError(`iam token 'gcp', which is not registered`)

  expect(lastCreateBody).toBeUndefined()
})

test('coercing iam.tokens itself still works', async () => {
  // Serializing, stringifying and awaiting the map must keep working — that is
  // what the four exempt names above were there for, and it is served without
  // reopening the guard now.
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    iam: { tokens: { aws: awsToken } },
    network: {
      rules: {
        'api.internal.example.com': [
          {
            transform: ({ iam }) => ({
              headers: {
                'X-Json': JSON.stringify(iam.tokens),
                'X-String': String(iam.tokens),
                'X-Template': `${iam.tokens}`,
                'X-Context': JSON.stringify({ iam }),
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
    'X-Json': '{"aws":"${e2b.identity.tokens.aws}"}',
    'X-String': '[object Object]',
    'X-Template': '[object Object]',
    'X-Context': '{"iam":{"tokens":{"aws":"${e2b.identity.tokens.aws}"}}}',
  })
})

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
