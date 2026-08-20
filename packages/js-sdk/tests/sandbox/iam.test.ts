import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { InvalidArgumentError, Sandbox, Secret } from '../../src'
import { iamTokenPlaceholders } from '../../src/sandbox/iam'
import { TEST_API_KEY, apiUrl } from '../setup'

const RUNTIME_PROBED_PROPS = ['toJSON', 'then', 'toString', 'valueOf']

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

test('the token map serializes, awaits and coerces like a plain object', async () => {
  const tokens = iamTokenPlaceholders(['aws'], { validate: true })

  expect(JSON.stringify(tokens)).toBe('{"aws":"${e2b.identity.tokens.aws}"}')
  expect(String(tokens)).toBe('[object Object]')
  expect(`${tokens}`).toBe('[object Object]')
  expect({ ...tokens }).toEqual({ aws: '${e2b.identity.tokens.aws}' })
  // A non-callable `then` keeps the map a plain value rather than a thenable.
  expect(await tokens).toBe(tokens)
})

test.for(RUNTIME_PROBED_PROPS)(
  'reading the unregistered token %s throws instead of resolving',
  (prop: string) => {
    // The runtime reads these names off anything it serializes, awaits or
    // coerces, so a lookup cannot be answered with an error — but using the
    // value as a token has to fail like any other unregistered name, instead of
    // putting 'undefined' or a built-in's source text on the wire.
    const tokens = iamTokenPlaceholders(['aws'], { validate: true })

    expect(() => `${tokens[prop]}`).toThrowError(
      `iam token '${prop}', which is not registered`
    )
    expect(() => String(tokens[prop])).toThrowError(InvalidArgumentError)
    // A header value is serialized rather than coerced when a callback assigns
    // the value straight through instead of interpolating it.
    expect(() => JSON.stringify({ header: tokens[prop] })).toThrowError(
      InvalidArgumentError
    )
  }
)

test('the runtime-probed valueOf answers with the guarded map', () => {
  // It stays callable for `String(iam.tokens)`, so it must not hand out the
  // unguarded record, whose unregistered names read as 'undefined'.
  const tokens = iamTokenPlaceholders(['aws'], { validate: true })

  expect(tokens.valueOf().aws).toBe('${e2b.identity.tokens.aws}')
  expect(() => `${tokens.valueOf().gcp}`).toThrowError(
    /iam token 'gcp'.*Registered tokens: 'aws'/s
  )
})

test.for(RUNTIME_PROBED_PROPS)(
  'the unchecked token map resolves %s to its placeholder',
  (prop: string) => {
    // The update-network payload carries no iam config, so no name can be
    // reported as unregistered; the probed names resolve like any other.
    const tokens = iamTokenPlaceholders([], { validate: false })

    expect(`${tokens[prop]}`).toBe(`\${e2b.identity.tokens.${prop}}`)
    expect(JSON.stringify(tokens)).toBe('{}')
    expect(String(tokens)).toBe('[object Object]')
  }
)
