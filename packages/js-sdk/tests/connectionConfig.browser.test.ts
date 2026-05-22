import { afterEach, assert, test, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('../src/utils')
})

test('sandbox_url keeps per-sandbox host in browser runtime', async () => {
  vi.doMock('../src/utils', () => ({
    runtime: 'browser',
    runtimeVersion: 'test',
  }))

  const { ConnectionConfig } = await import('../src/connectionConfig')
  const config = new ConnectionConfig()

  assert.equal(
    config.getSandboxUrl('sbx-test', {
      sandboxDomain: 'e2b.app',
      envdPort: 49983,
    }),
    'https://49983-sbx-test.e2b.app'
  )
})
