import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

const sandboxId = 'test-sandbox-id'

let lastCreateBody: Record<string, any> | undefined
let lastUpdateBody: Record<string, any> | undefined
let sandboxNetwork: Record<string, any> | undefined

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
  }),
  http.get(apiUrl(`/sandboxes/${sandboxId}`), () =>
    HttpResponse.json({
      sandboxID: sandboxId,
      templateID: 'base',
      clientID: 'test-client',
      envdVersion: '0.2.4',
      startedAt: '2026-01-01T00:00:00Z',
      endAt: '2026-01-01T01:00:00Z',
      state: 'running',
      cpuCount: 2,
      memoryMB: 512,
      diskSizeMB: 1024,
      network: sandboxNetwork,
    })
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => {
  lastCreateBody = undefined
  lastUpdateBody = undefined
  sandboxNetwork = undefined
  server.resetHandlers()
})

test('Sandbox.create sends the egress proxy in the request body', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: {
      egressProxy: {
        address: 'proxy.example.com:1080',
        username: 'proxy-user',
        password: 'proxy-password',
      },
    },
  })

  expect(lastCreateBody?.network).toEqual({
    egressProxy: {
      address: 'proxy.example.com:1080',
      username: 'proxy-user',
      password: 'proxy-password',
    },
  })
})

test('Sandbox.create sends an address-only egress proxy without credentials', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: { egressProxy: { address: 'proxy.example.com:1080' } },
  })

  expect(lastCreateBody?.network.egressProxy).toEqual({
    address: 'proxy.example.com:1080',
  })
})

test('Sandbox.create combines the egress proxy with allow and deny lists', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: {
      allowOut: ['api.example.com'],
      denyOut: ({ allTraffic }) => [allTraffic],
      egressProxy: { address: 'proxy.example.com:1080' },
    },
  })

  expect(lastCreateBody?.network).toEqual({
    allowOut: ['api.example.com'],
    denyOut: ['0.0.0.0/0'],
    egressProxy: { address: 'proxy.example.com:1080' },
  })
})

test('Sandbox.create omits the egress proxy when not provided', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: { allowOut: ['api.example.com'] },
  })

  expect(lastCreateBody?.network).toBeDefined()
  expect(lastCreateBody?.network).not.toHaveProperty('egressProxy')
})

test('Sandbox.create strips unknown egress proxy properties', async () => {
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: {
      egressProxy: {
        address: 'proxy.example.com:1080',
        // An untyped caller can copy an extra key out of a config file; the
        // API rejects unknown properties.
        protocol: 'socks5',
      } as never,
    },
  })

  expect(lastCreateBody?.network.egressProxy).toEqual({
    address: 'proxy.example.com:1080',
  })
})

test.for([
  ['an empty object', {}],
  ['a non-string address', { address: 1080 }],
  ['a bare address string', 'proxy.example.com:1080'],
])(
  'Sandbox.create rejects %s as the egress proxy',
  async ([, egressProxy]: [string, unknown]) => {
    // Callers that bypass the type used to have the address silently dropped
    // from the rebuilt body and got an API error about a config they never
    // wrote; Python raises here too.
    await expect(
      Sandbox.create('base', {
        apiKey: TEST_API_KEY,
        network: { egressProxy: egressProxy as never },
      })
    ).rejects.toThrow(/egressProxy/)
  }
)

test('Sandbox.create omits null credentials', async () => {
  // Reading a credential out of an unset environment variable is how a caller
  // lands here, and it means the proxy takes no credentials — the API only
  // accepts a string.
  await Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: {
      egressProxy: {
        address: 'proxy.example.com:1080',
        username: null,
        password: null,
      } as never,
    },
  })

  expect(lastCreateBody?.network.egressProxy).toEqual({
    address: 'proxy.example.com:1080',
  })
})

test('a later mutation of the caller object does not reach the wire', async () => {
  const egressProxy = { address: 'proxy.example.com:1080', username: 'before' }

  const create = Sandbox.create('base', {
    apiKey: TEST_API_KEY,
    network: { egressProxy },
  })
  egressProxy.username = 'after'
  await create

  expect(lastCreateBody?.network.egressProxy.username).toEqual('before')
})

test('updateNetwork sets the egress proxy on a running sandbox', async () => {
  await Sandbox.updateNetwork(
    sandboxId,
    {
      allowOut: ['api.example.com'],
      denyOut: ({ allTraffic }) => [allTraffic],
      egressProxy: { address: 'proxy.example.com:1080' },
    },
    { apiKey: TEST_API_KEY }
  )

  expect(lastUpdateBody).toEqual({
    allowOut: ['api.example.com'],
    denyOut: ['0.0.0.0/0'],
    egressProxy: { address: 'proxy.example.com:1080' },
  })
})

test('an update without the egress proxy clears it', async () => {
  // The update replaces the whole configuration instead of merging into it, so
  // omitting the proxy stops tunneling rather than leaving it in place.
  await Sandbox.updateNetwork(sandboxId, {}, { apiKey: TEST_API_KEY })

  expect(lastUpdateBody).toEqual({})
})

test('getInfo reports the active egress proxy without the password', async () => {
  sandboxNetwork = {
    allowOut: ['api.example.com'],
    egressProxy: { address: 'proxy.example.com:1080', username: 'proxy-user' },
  }

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.network?.egressProxy).toEqual({
    address: 'proxy.example.com:1080',
    username: 'proxy-user',
  })
})

test('getInfo drops a password the API unexpectedly returns', async () => {
  // SandboxEgressProxyInfo says the password is not there, so it must not be
  // there even if a future API version starts echoing it back.
  sandboxNetwork = {
    egressProxy: {
      address: 'proxy.example.com:1080',
      password: 'proxy-password',
    },
  }

  const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

  expect(info.network?.egressProxy).toEqual({
    address: 'proxy.example.com:1080',
  })
})

test.for([
  ['omitted', {}],
  ['null', { egressProxy: null }],
])(
  'getInfo reports no egress proxy when the API returns %s',
  async ([, network]: [string, Record<string, any>]) => {
    // The wire field is nullable; absence has to be `undefined` either way so
    // the null never reaches a consumer.
    sandboxNetwork = network

    const info = await Sandbox.getInfo(sandboxId, { apiKey: TEST_API_KEY })

    expect(info.network).toBeDefined()
    expect(info.network?.egressProxy).toBeUndefined()
  }
)
