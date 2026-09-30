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
  delete process.env.E2B_HTTP_VERSION
})

async function createSandbox(opts: {
  httpVersion?: '1.1' | '2'
  proxy?: string
}) {
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

  assert.deepEqual(mocks.createEnvdFetch.mock.calls[0], [undefined, '2'])
  assert.deepEqual(mocks.createEnvdRpcFetch.mock.calls[0], [undefined, '2'])
})

test('httpVersion: 1.1 pins envd HTTP and RPC fetchers to HTTP/1.1', async () => {
  await createSandbox({ httpVersion: '1.1', proxy: 'http://127.0.0.1:8080' })

  assert.deepEqual(mocks.createEnvdFetch.mock.calls[0], [
    'http://127.0.0.1:8080',
    '1.1',
  ])
  assert.deepEqual(mocks.createEnvdRpcFetch.mock.calls[0], [
    'http://127.0.0.1:8080',
    '1.1',
  ])
})

test('E2B_HTTP_VERSION=1.1 pins envd fetchers to HTTP/1.1', async () => {
  process.env.E2B_HTTP_VERSION = '1.1'
  await createSandbox({})

  assert.deepEqual(mocks.createEnvdFetch.mock.calls[0], [undefined, '1.1'])
  assert.deepEqual(mocks.createEnvdRpcFetch.mock.calls[0], [undefined, '1.1'])
})
