import { assert, test, expect, vi } from 'vitest'

import { Sandbox } from '../../src'
import { isDebug, sandboxTest, template } from '../setup.js'

test('connect in debug mode does not call the API', async () => {
  const fetchSpy = vi.fn(() => {
    throw new Error('unexpected request in debug mode')
  })
  vi.stubGlobal('fetch', fetchSpy)

  try {
    const sbx = await Sandbox.connect('debug-sandbox-id', {
      debug: true,
      apiKey: 'test-api-key',
    })
    assert.equal(sbx.sandboxId, 'debug-sandbox-id')

    const sameSbx = await sbx.connect()
    assert.strictEqual(sameSbx, sbx)

    expect(fetchSpy).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})

test.skipIf(isDebug)('connect', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 10_000 })

  try {
    const isRunning = await sbx.isRunning()
    assert.isTrue(isRunning)

    const sbxConnection = await Sandbox.connect(sbx.sandboxId)
    const isRunning2 = await sbxConnection.isRunning()
    assert.isTrue(isRunning2)
  } finally {
    if (!isDebug) {
      await sbx.kill()
    }
  }
})

sandboxTest.skipIf(isDebug)(
  'connect resumes paused sandbox',
  async ({ sandbox }) => {
    await sandbox.pause()
    assert.isFalse(await sandbox.isRunning())

    const resumed = await Sandbox.connect(sandbox.sandboxId)
    assert.isTrue(await resumed.isRunning())
  }
)

sandboxTest.skipIf(isDebug)(
  'connect to non-running sandbox',
  async ({ sandbox }) => {
    const isRunning = await sandbox.isRunning()
    assert.isTrue(isRunning)
    await sandbox.kill()

    const connectPromise = Sandbox.connect(sandbox.sandboxId)
    await expect(connectPromise).rejects.toThrowError(
      expect.objectContaining({
        name: 'SandboxNotFoundError',
      })
    )
  }
)

test.skipIf(isDebug)(
  'connect does not shorten timeout on running sandbox',
  async () => {
    // Create sandbox with a 300 second timeout
    const sbx = await Sandbox.create(template, { timeoutMs: 300_000 })

    try {
      const isRunning = await sbx.isRunning()
      assert.isTrue(isRunning)

      // Get initial info to check endAt
      const infoBefore = await Sandbox.getInfo(sbx.sandboxId)

      // Connect with a shorter timeout (10 seconds)
      await Sandbox.connect(sbx.sandboxId, { timeoutMs: 10_000 })

      // Get info after connection
      const infoAfter = await sbx.getInfo()

      // The endAt time should not have been shortened. It should be the same
      assert.equal(
        infoAfter.endAt.getTime(),
        infoBefore.endAt.getTime(),
        `Timeout was shortened: before=${infoBefore.endAt.toISOString()}, after=${infoAfter.endAt.toISOString()}`
      )
    } finally {
      await sbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'connect extends timeout on running sandbox',
  async ({ sandbox }) => {
    // Get initial info to check endAt
    const infoBefore = await sandbox.getInfo()

    // Connect with a longer timeout
    await sandbox.connect({ timeoutMs: 600_000 })

    // Get info after connection
    const infoAfter = await sandbox.getInfo()

    // The endAt time should have been extended
    assert.isTrue(
      infoAfter.endAt.getTime() > infoBefore.endAt.getTime(),
      `Timeout was not extended: before=${infoBefore.endAt.toISOString()}, after=${infoAfter.endAt.toISOString()}`
    )
  }
)
