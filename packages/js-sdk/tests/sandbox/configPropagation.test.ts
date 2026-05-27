import { afterEach, assert, beforeEach, describe, test, vi } from 'vitest'

import { Sandbox } from '../../src'
import { SandboxApi } from '../../src/sandbox/sandboxApi'

let originalSandboxUrl: string | undefined

const baseConfig = {
  apiKey: 'e2b_0000000000000000000000000000000000000000',
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
  beforeEach(() => {
    originalSandboxUrl = process.env.E2B_SANDBOX_URL
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalSandboxUrl === undefined) {
      delete process.env.E2B_SANDBOX_URL
    } else {
      process.env.E2B_SANDBOX_URL = originalSandboxUrl
    }
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

  test('updateNetwork forwards per-call signal', async () => {
    const updateNetworkSpy = vi
      .spyOn(SandboxApi, 'updateNetwork')
      .mockResolvedValue()
    const sandbox = createSandbox()
    const controller = new AbortController()

    await sandbox.updateNetwork({}, { signal: controller.signal })

    const opts = updateNetworkSpy.mock.calls[0][2]
    assert.equal(opts?.signal, controller.signal)
  })

  test('downloadUrl keeps sandbox identity in production direct URLs', async () => {
    delete process.env.E2B_SANDBOX_URL

    const sandbox = new Sandbox({
      sandboxId: 'sbx-test',
      sandboxDomain: 'e2b.app',
      envdVersion: '0.2.4',
      domain: 'e2b.app',
      debug: false,
    })

    assert.equal(
      await sandbox.downloadUrl('/hello.txt'),
      'https://49983-sbx-test.e2b.app/files?username=user&path=%2Fhello.txt'
    )
  })
})
