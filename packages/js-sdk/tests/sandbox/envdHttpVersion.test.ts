import { afterEach, assert, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createEnvdFetch: vi.fn(() => vi.fn()),
  createEnvdRpcFetch: vi.fn(() => vi.fn()),
}))

vi.mock('@connectrpc/connect-web', () => ({
  createConnectTransport: vi.fn(() => ({})),
}))

vi.mock('../../src/envd/http2', () => ({
  createEnvdFetch: mocks.createEnvdFetch,
  createEnvdRpcFetch: mocks.createEnvdRpcFetch,
}))

afterEach(() => {
  vi.clearAllMocks()
  delete process.env.E2B_SANDBOX_HTTP2
})

async function createSandbox(opts: { sandboxHttp2?: boolean; proxy?: string }) {
  const { ConnectionConfig, Sandbox } = await import('../../src')
  const config = new ConnectionConfig(opts)
  return new Sandbox({
    ...config,
    sandboxId: 'sbx-test',
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion: '0.2.4',
    envdAccessToken: 'tok',
  })
}

test('envd fetchers default to HTTP/2', async () => {
  await createSandbox({})

  assert.deepEqual(mocks.createEnvdFetch.mock.calls[0], [undefined, true])
  assert.deepEqual(mocks.createEnvdRpcFetch.mock.calls[0], [undefined, true])
})

test('sandboxHttp2: false pins envd HTTP and RPC fetchers to HTTP/1.1', async () => {
  await createSandbox({ sandboxHttp2: false, proxy: 'http://127.0.0.1:8080' })

  assert.deepEqual(mocks.createEnvdFetch.mock.calls[0], [
    'http://127.0.0.1:8080',
    false,
  ])
  assert.deepEqual(mocks.createEnvdRpcFetch.mock.calls[0], [
    'http://127.0.0.1:8080',
    false,
  ])
})

test('E2B_SANDBOX_HTTP2=false pins envd fetchers to HTTP/1.1', async () => {
  process.env.E2B_SANDBOX_HTTP2 = 'false'
  await createSandbox({})

  assert.deepEqual(mocks.createEnvdFetch.mock.calls[0], [undefined, false])
  assert.deepEqual(mocks.createEnvdRpcFetch.mock.calls[0], [undefined, false])
})
