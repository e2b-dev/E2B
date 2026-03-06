import { afterEach, describe, expect, it, vi } from 'vitest'

import { Sandbox } from '../../src'
import { SandboxApi } from '../../src/sandbox/sandboxApi'

const baseConfig = {
  apiKey: 'base-api-key',
  domain: 'base.e2b.dev',
  requestTimeoutMs: 1111,
  debug: false,
  headers: {
    'X-Test': 'base',
  },
}

function createSandbox() {
  return new Sandbox({
    sandboxId: 'sbx-config-propagation',
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion: '0.2.4',
    envdAccessToken: 'envd-access-token',
    trafficAccessToken: 'traffic-access-token',
    ...baseConfig,
  })
}

function assertForwardsBaseConfig(forwardedOpts: unknown) {
  expect(forwardedOpts).toEqual(
    expect.objectContaining({
      apiKey: baseConfig.apiKey,
      domain: baseConfig.domain,
      requestTimeoutMs: baseConfig.requestTimeoutMs,
      debug: baseConfig.debug,
      headers: expect.objectContaining(baseConfig.headers),
    })
  )
}

describe('Sandbox instance config propagation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards stored config for pause()', async () => {
    const sandbox = createSandbox()
    const pauseSpy = vi
      .spyOn(SandboxApi as any, 'pause')
      .mockResolvedValue(true)

    await sandbox.pause()

    const forwardedOpts = pauseSpy.mock.calls[0][1]
    assertForwardsBaseConfig(forwardedOpts)
  })

  it('forwards stored config for betaPause()', async () => {
    const sandbox = createSandbox()
    const pauseSpy = vi
      .spyOn(SandboxApi as any, 'betaPause')
      .mockResolvedValue(true)

    await sandbox.betaPause()

    const forwardedOpts = pauseSpy.mock.calls[0][1]
    assertForwardsBaseConfig(forwardedOpts)
  })

  it('forwards stored config for instance connect()', async () => {
    const sandbox = createSandbox()
    const connectSpy = vi
      .spyOn(SandboxApi as any, 'connectSandbox')
      .mockResolvedValue({})

    await sandbox.connect()

    const forwardedOpts = connectSpy.mock.calls[0][1]
    assertForwardsBaseConfig(forwardedOpts)
  })

  it('forwards stored config for setTimeout() control method', async () => {
    const sandbox = createSandbox()
    const setTimeoutSpy = vi
      .spyOn(SandboxApi as any, 'setTimeout')
      .mockResolvedValue(undefined)

    await sandbox.setTimeout(5000)

    const forwardedOpts = setTimeoutSpy.mock.calls[0][2]
    assertForwardsBaseConfig(forwardedOpts)
  })
})

describe('Sandbox instance config overrides', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies override opts for pause()', async () => {
    const sandbox = createSandbox()
    const pauseSpy = vi
      .spyOn(SandboxApi as any, 'pause')
      .mockResolvedValue(true)
    const override = {
      domain: 'override.e2b.dev',
      requestTimeoutMs: 9999,
      headers: {
        'X-Test': 'override',
      },
    }

    await sandbox.pause(override)

    const forwardedOpts = pauseSpy.mock.calls[0][1]
    expect(forwardedOpts).toEqual(
      expect.objectContaining({
        apiKey: baseConfig.apiKey,
        domain: override.domain,
        requestTimeoutMs: override.requestTimeoutMs,
        headers: override.headers,
      })
    )
  })

  it('applies override opts for betaPause()', async () => {
    const sandbox = createSandbox()
    const pauseSpy = vi
      .spyOn(SandboxApi as any, 'betaPause')
      .mockResolvedValue(true)
    const override = {
      domain: 'override.e2b.dev',
      requestTimeoutMs: 9999,
    }

    await sandbox.betaPause(override)

    const forwardedOpts = pauseSpy.mock.calls[0][1]
    expect(forwardedOpts).toEqual(
      expect.objectContaining({
        apiKey: baseConfig.apiKey,
        domain: override.domain,
        requestTimeoutMs: override.requestTimeoutMs,
      })
    )
  })

  it('applies override opts for instance connect()', async () => {
    const sandbox = createSandbox()
    const connectSpy = vi
      .spyOn(SandboxApi as any, 'connectSandbox')
      .mockResolvedValue({})
    const override = {
      domain: 'override.e2b.dev',
      requestTimeoutMs: 2222,
      timeoutMs: 8888,
    }

    await sandbox.connect(override)

    const forwardedOpts = connectSpy.mock.calls[0][1]
    expect(forwardedOpts).toEqual(
      expect.objectContaining({
        apiKey: baseConfig.apiKey,
        domain: override.domain,
        requestTimeoutMs: override.requestTimeoutMs,
        timeoutMs: override.timeoutMs,
      })
    )
  })

  it('applies override opts for setTimeout() control method', async () => {
    const sandbox = createSandbox()
    const setTimeoutSpy = vi
      .spyOn(SandboxApi as any, 'setTimeout')
      .mockResolvedValue(undefined)

    await sandbox.setTimeout(5000, { requestTimeoutMs: 2222 })

    const forwardedOpts = setTimeoutSpy.mock.calls[0][2]
    expect(forwardedOpts).toEqual(
      expect.objectContaining({
        apiKey: baseConfig.apiKey,
        domain: baseConfig.domain,
        requestTimeoutMs: 2222,
      })
    )
  })
})
