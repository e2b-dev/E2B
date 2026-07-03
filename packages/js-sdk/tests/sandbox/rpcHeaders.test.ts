import { assert, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpcFetch: vi.fn(async () => new Response(null, { status: 204 })),
  transportFetch: undefined as typeof fetch | undefined,
}))

vi.mock('@connectrpc/connect-web', () => ({
  createConnectTransport: vi.fn((opts: { fetch: typeof fetch }) => {
    mocks.transportFetch = opts.fetch
    return {}
  }),
}))

vi.mock('../../src/envd/http2', () => ({
  createEnvdFetch: vi.fn(() => vi.fn()),
  createEnvdRpcFetch: vi.fn(() => mocks.rpcFetch),
}))

test('does not pass custom connection headers to envd RPC requests', async () => {
  const { ConnectionConfig, Sandbox } = await import('../../src')
  ConnectionConfig.setIntegration('testing/version')
  const config = new ConnectionConfig()
  const sandbox = new Sandbox({
    ...config,
    sandboxId: 'sbx-test',
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion: '0.2.4',
    envdAccessToken: 'tok',
    headers: {
      Authorization: 'Bearer user-token',
      'X-Custom': 'secret',
    },
  })

  assert.equal(sandbox.sandboxId, 'sbx-test')
  assert.ok(mocks.transportFetch)
  await mocks.transportFetch('https://sandbox.e2b.dev/rpc', {
    headers: { 'Connect-Protocol-Version': '1' },
  })

  const headers = new Headers(mocks.rpcFetch.mock.calls[0][1]?.headers)

  assert.equal(headers.get('Authorization'), null)
  assert.equal(headers.get('X-Custom'), null)
  assert.equal(headers.get('User-Agent')?.startsWith('e2b-js-sdk/'), true)
  assert.equal(headers.get('User-Agent')?.endsWith(' testing/version'), true)
  assert.equal(headers.get('E2b-Sandbox-Id'), 'sbx-test')
  assert.equal(headers.get('X-Access-Token'), 'tok')
  assert.equal(headers.get('Connect-Protocol-Version'), '1')
})
