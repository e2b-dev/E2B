import { describe, expect, it } from 'vitest'

import { Sandbox } from '../../src'

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

describe('resolveApiOpts', () => {
  it('returns connectionConfig when called without overrides', () => {
    const sandbox = createSandbox()
    const result = (sandbox as any).resolveApiOpts()

    expect(result).toEqual(
      expect.objectContaining({
        apiKey: baseConfig.apiKey,
        domain: baseConfig.domain,
        requestTimeoutMs: baseConfig.requestTimeoutMs,
        debug: baseConfig.debug,
        headers: expect.objectContaining(baseConfig.headers),
      })
    )
  })

  it('overrides connectionConfig with provided opts', () => {
    const sandbox = createSandbox()
    const result = (sandbox as any).resolveApiOpts({
      domain: 'override.e2b.dev',
      requestTimeoutMs: 9999,
    })

    expect(result).toEqual(
      expect.objectContaining({
        apiKey: baseConfig.apiKey,
        domain: 'override.e2b.dev',
        requestTimeoutMs: 9999,
        debug: baseConfig.debug,
      })
    )
  })
})
