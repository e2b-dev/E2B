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
import { ALT_USED_HEADER, clearResolvedDomains } from '../src/resolvedDomains'
import { setupMockApi } from './mockApi'

const API_KEY_A = `e2b_${'a'.repeat(40)}`
const API_KEY_B = `e2b_${'b'.repeat(40)}`
const ORIGINAL_DOMAIN = 'e2b.dev'
const RESOLVED_DOMAIN = 'e2b-juliett.dev'
const PINNED_ENV_VALUES = [
  ['E2B_DOMAIN', 'e2b.dev'],
  ['E2B_API_URL', 'https://api.e2b.dev'],
  ['E2B_SANDBOX_URL', 'https://sandbox.example.com'],
  ['E2B_VOLUME_API_URL', 'https://api.e2b.dev'],
] as const

let responseHeader: string | null = RESOLVED_DOMAIN
const requestedHosts: string[] = []

function jsonResponse(body: unknown) {
  return HttpResponse.json(
    body,
    responseHeader === null
      ? undefined
      : { headers: { [ALT_USED_HEADER]: responseHeader } }
  )
}

const server = setupMockApi(
  http.get(/\/v2\/sandboxes$/, ({ request }) => {
    requestedHosts.push(new URL(request.url).host)
    return jsonResponse([])
  }),
  http.post(/\/v2\/sandboxes$/, ({ request }) => {
    requestedHosts.push(new URL(request.url).host)
    return jsonResponse({
      sandboxID: 'sandbox-id',
      domain: null,
      envdVersion: '0.4.0',
    })
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
  for (const [name] of PINNED_ENV_VALUES) {
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
  test('records the control-plane domain and uses it for later requests', async () => {
    const original = new ConnectionConfig({
      domain: ORIGINAL_DOMAIN,
      apiKey: API_KEY_A,
      debug: false,
    })
    await sendRequest(original)

    const resolved = new ConnectionConfig({
      domain: ORIGINAL_DOMAIN,
      apiKey: API_KEY_A,
      debug: false,
    })
    expect(resolved.domain).toBe(RESOLVED_DOMAIN)
    expect(resolved.apiUrl).toBe(`https://api.${RESOLVED_DOMAIN}`)

    await sendRequest(resolved)
    expect(requestedHosts).toEqual([
      `api.${ORIGINAL_DOMAIN}`,
      `api.${RESOLVED_DOMAIN}`,
    ])
  })

  test('scopes the resolved domain by api key and original domain', async () => {
    await sendRequest(
      new ConnectionConfig({
        domain: ORIGINAL_DOMAIN,
        apiKey: API_KEY_A,
        debug: false,
      })
    )

    expect(
      new ConnectionConfig({
        domain: ORIGINAL_DOMAIN,
        apiKey: API_KEY_B,
        debug: false,
      }).domain
    ).toBe(ORIGINAL_DOMAIN)
    expect(
      new ConnectionConfig({
        domain: 'other.dev',
        apiKey: API_KEY_A,
        debug: false,
      }).domain
    ).toBe('other.dev')
  })

  test('does not record for custom api URLs or debug configs', async () => {
    await sendRequest(
      new ConnectionConfig({
        domain: ORIGINAL_DOMAIN,
        apiKey: API_KEY_A,
        apiUrl: 'https://proxy.example',
        debug: false,
      })
    )
    await sendRequest(
      new ConnectionConfig({
        domain: ORIGINAL_DOMAIN,
        apiKey: API_KEY_A,
        debug: true,
      })
    )

    const unchanged = new ConnectionConfig({
      domain: ORIGINAL_DOMAIN,
      apiKey: API_KEY_A,
      debug: false,
    })
    expect(unchanged.domain).toBe(ORIGINAL_DOMAIN)
    expect(unchanged.apiUrl).toBe(`https://api.${ORIGINAL_DOMAIN}`)
    expect(requestedHosts).toEqual(['proxy.example', 'localhost:3000'])
  })

  test('switches explicit canonical api URLs and rebuilt configs', async () => {
    const original = new ConnectionConfig({
      domain: ORIGINAL_DOMAIN,
      apiKey: API_KEY_A,
      apiUrl: `https://api.${ORIGINAL_DOMAIN}`,
      debug: false,
    })
    await sendRequest(original)

    const rebuilt = new ConnectionConfig({ ...original })
    expect(rebuilt.domain).toBe(RESOLVED_DOMAIN)
    expect(rebuilt.apiUrl).toBe(`https://api.${RESOLVED_DOMAIN}`)
  })

  test.each(PINNED_ENV_VALUES)(
    '%s disables domain discovery',
    async (name, value) => {
      vi.stubEnv(name, value)
      const apiUrl = `https://api.${ORIGINAL_DOMAIN}`
      await sendRequest(
        new ConnectionConfig({
          domain: ORIGINAL_DOMAIN,
          apiKey: API_KEY_A,
          apiUrl,
          debug: false,
        })
      )

      const unchanged = new ConnectionConfig({
        domain: ORIGINAL_DOMAIN,
        apiKey: API_KEY_A,
        apiUrl,
        debug: false,
      })
      expect(unchanged.domain).toBe(ORIGINAL_DOMAIN)
      await sendRequest(unchanged)
      expect(requestedHosts).toEqual([
        `api.${ORIGINAL_DOMAIN}`,
        `api.${ORIGINAL_DOMAIN}`,
      ])
    }
  )

  test.each([
    'https://e2b-juliett.dev',
    'e2b-juliett.dev:443',
    'a b',
    '',
    ORIGINAL_DOMAIN,
  ])('ignores invalid or unchanged response domain %j', async (value) => {
    clearResolvedDomains()
    responseHeader = value
    await sendRequest(
      new ConnectionConfig({
        domain: ORIGINAL_DOMAIN,
        apiKey: API_KEY_A,
        debug: false,
      })
    )

    const unchanged = new ConnectionConfig({
      domain: ORIGINAL_DOMAIN,
      apiKey: API_KEY_A,
      debug: false,
    })
    expect(unchanged.domain).toBe(ORIGINAL_DOMAIN)
    expect(unchanged.apiUrl).toBe(`https://api.${ORIGINAL_DOMAIN}`)
  })

  test('uses the resolved domain as the sandbox-domain fallback', async () => {
    const sandbox = await Sandbox.create({
      domain: ORIGINAL_DOMAIN,
      apiKey: API_KEY_A,
      debug: false,
    })

    expect(sandbox.sandboxDomain).toBe(RESOLVED_DOMAIN)
  })
})
