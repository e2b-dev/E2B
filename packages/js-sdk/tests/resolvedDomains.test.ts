import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'

import { ApiClient, ConnectionConfig, Sandbox } from '../src'
import type { ConnectionOpts } from '../src/connectionConfig'
import {
  ALT_USED_HEADER,
  clearResolvedDomains,
  getResolvedDomain,
  recordResolvedDomain,
} from '../src/resolvedDomains'
import { setupMockApi } from './mockApi'

const API_KEY_A = `e2b_${'a'.repeat(40)}`
const API_KEY_B = `e2b_${'b'.repeat(40)}`
const DEFAULT_DOMAIN = 'e2b.app'
const RESOLVED_DOMAIN = 'e2b-juliett.dev'
const INELIGIBLE_CONFIGS: {
  name: string
  options?: ConnectionOpts
  env?: readonly [string, string]
}[] = [
  { name: 'opts.domain', options: { domain: DEFAULT_DOMAIN } },
  { name: 'opts.apiUrl', options: { apiUrl: 'https://api.custom.example' } },
  {
    name: 'opts.sandboxUrl',
    options: { sandboxUrl: 'https://sandbox.example' },
  },
  { name: 'E2B_DOMAIN', env: ['E2B_DOMAIN', 'e2b.custom'] },
  { name: 'E2B_API_URL', env: ['E2B_API_URL', 'https://api.custom.example'] },
  {
    name: 'E2B_SANDBOX_URL',
    env: ['E2B_SANDBOX_URL', 'https://sandbox.example'],
  },
  { name: 'debug option', options: { debug: true } },
  { name: 'E2B_DEBUG', env: ['E2B_DEBUG', 'true'] },
]

let responseHeader: string | null = RESOLVED_DOMAIN
const requestedHosts: string[] = []

function jsonResponse(body: unknown, status = 200) {
  return HttpResponse.json(body, {
    status,
    headers:
      responseHeader === null
        ? undefined
        : { [ALT_USED_HEADER]: responseHeader },
  })
}

const server = setupMockApi(
  http.get(/\/v2\/sandboxes$/, ({ request }) => {
    requestedHosts.push(new URL(request.url).host)
    return jsonResponse([])
  }),
  http.post(/\/v2\/sandboxes$/, ({ request }) => {
    requestedHosts.push(new URL(request.url).host)
    return jsonResponse(
      {
        sandboxID: 'sandbox-id',
        clientID: 'client-id',
        domain: null,
        envdVersion: '0.4.0',
      },
      201
    )
  })
)

beforeAll(async () => {
  await server.listen({ onUnhandledRequest: 'error' })
})

afterAll(async () => {
  await server.close()
})

beforeEach(() => {
  clearResolvedDomains()
  requestedHosts.length = 0
  responseHeader = RESOLVED_DOMAIN
  for (const name of [
    'E2B_DOMAIN',
    'E2B_API_URL',
    'E2B_SANDBOX_URL',
    'E2B_DEBUG',
  ]) {
    vi.stubEnv(name, '')
  }
  server.resetHandlers()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function sendRequest(config: ConnectionConfig) {
  await new ApiClient(config).api.GET('/v2/sandboxes')
}

describe('resolved domains', () => {
  test('records a resolved domain for a default config and uses it later', async () => {
    await sendRequest(new ConnectionConfig({ apiKey: API_KEY_A }))

    const resolved = new ConnectionConfig({ apiKey: API_KEY_A })
    expect(resolved.domain).toBe(RESOLVED_DOMAIN)
    expect(resolved.apiUrl).toBe(`https://api.${RESOLVED_DOMAIN}`)

    await sendRequest(resolved)
    expect(requestedHosts).toEqual([
      `api.${DEFAULT_DOMAIN}`,
      `api.${RESOLVED_DOMAIN}`,
    ])
  })

  test('does not reuse a resolved domain for a different API key', async () => {
    await sendRequest(new ConnectionConfig({ apiKey: API_KEY_A }))

    const otherKey = new ConnectionConfig({ apiKey: API_KEY_B })
    expect(otherKey.domain).toBe(DEFAULT_DOMAIN)
    expect(otherKey.apiUrl).toBe(`https://api.${DEFAULT_DOMAIN}`)
  })

  test.each(INELIGIBLE_CONFIGS)(
    '$name prevents recording and cache switching',
    async ({ options, env }) => {
      if (env) {
        vi.stubEnv(env[0], env[1])
      }

      const ineligible = new ConnectionConfig({
        apiKey: API_KEY_A,
        ...(options ?? {}),
      })
      expect(ineligible.discoverDomain).toBe(false)
      await sendRequest(ineligible)

      if (env) {
        vi.stubEnv(env[0], '')
      }
      expect(new ConnectionConfig({ apiKey: API_KEY_A }).domain).toBe(
        DEFAULT_DOMAIN
      )

      clearResolvedDomains()
      recordResolvedDomain(API_KEY_A, RESOLVED_DOMAIN)
      if (env) {
        vi.stubEnv(env[0], env[1])
      }
      const cachedConfig = new ConnectionConfig({
        apiKey: API_KEY_A,
        ...(options ?? {}),
      })
      const expectedDomain =
        options?.domain ?? (env?.[0] === 'E2B_DOMAIN' ? env[1] : DEFAULT_DOMAIN)
      expect(cachedConfig.domain).toBe(expectedDomain)
    }
  )

  test.each(['https://e2b-juliett.dev', 'e2b-juliett.dev:443', 'a b', ''])(
    'ignores malformed response domain %j',
    async (value) => {
      responseHeader = value
      await sendRequest(new ConnectionConfig({ apiKey: API_KEY_A }))

      const unchanged = new ConnectionConfig({ apiKey: API_KEY_A })
      expect(unchanged.domain).toBe(DEFAULT_DOMAIN)
      expect(unchanged.apiUrl).toBe(`https://api.${DEFAULT_DOMAIN}`)
    }
  )

  test('accepts a valid host matching the default domain', async () => {
    responseHeader = DEFAULT_DOMAIN
    await sendRequest(new ConnectionConfig({ apiKey: API_KEY_A }))
    expect(getResolvedDomain(API_KEY_A)).toBe(DEFAULT_DOMAIN)
  })

  test('uses the cached domain for a later Sandbox.create', async () => {
    await Sandbox.create({ apiKey: API_KEY_A })

    const sandbox = await Sandbox.create({ apiKey: API_KEY_A })
    expect(sandbox.sandboxDomain).toBe(RESOLVED_DOMAIN)
    expect(requestedHosts).toEqual([
      `api.${DEFAULT_DOMAIN}`,
      `api.${RESOLVED_DOMAIN}`,
    ])
  })
})
