import { afterEach, assert, describe, test, vi } from 'vitest'

import { Sandbox } from '../../src'
import { SandboxApi } from '../../src/sandbox/sandboxApi'

const baseConfig = {
  apiKey: 'base-api-key',
  domain: 'base.e2b.dev',
  requestTimeoutMs: 1111,
  debug: false,
  headers: { 'X-Test': 'base' },
}

function createSandbox() {
  return new Sandbox({
    sandboxId: 'sbx-test',
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion: '0.2.4',
    envdAccessToken: 'tok',
    trafficAccessToken: 'tok',
    ...baseConfig,
  })
}

describe('Sandbox API config propagation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('passes connectionConfig to public API methods when called without overrides', async () => {
    const pauseSpy = vi.spyOn(SandboxApi, 'pause').mockResolvedValue(true)
    const sandbox = createSandbox()

    await sandbox.pause()

    const opts = pauseSpy.mock.calls[0][1]
    assert.equal(opts?.apiKey, baseConfig.apiKey)
    assert.equal(opts?.domain, baseConfig.domain)
    assert.equal(opts?.requestTimeoutMs, baseConfig.requestTimeoutMs)
    assert.equal(opts?.debug, baseConfig.debug)
    assert.equal(opts?.headers?.['X-Test'], baseConfig.headers['X-Test'])
  })

  test('lets public method call overrides win over connectionConfig', async () => {
    const pauseSpy = vi.spyOn(SandboxApi, 'pause').mockResolvedValue(true)
    const sandbox = createSandbox()

    await sandbox.pause({
      domain: 'override.e2b.dev',
      requestTimeoutMs: 9999,
    })

    const opts = pauseSpy.mock.calls[0][1]
    assert.equal(opts?.apiKey, baseConfig.apiKey)
    assert.equal(opts?.domain, 'override.e2b.dev')
    assert.equal(opts?.requestTimeoutMs, 9999)
    assert.equal(opts?.debug, baseConfig.debug)
  })
})
