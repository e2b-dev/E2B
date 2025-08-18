import { assert, test, expect } from 'vitest'

import { Sandbox } from '../../src'
import { isDebug, sandboxTest, template } from '../setup.js'

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
  'connect to non-running sandbox',
  async ({ sandbox }) => {
    const isRunning = await sandbox.isRunning()
    assert.isTrue(isRunning)
    await sandbox.kill()

    const connectPromise = Sandbox.connect(sandbox.sandboxId)
    await expect(connectPromise).rejects.toThrowError(
      expect.objectContaining({
        name: 'NotFoundError',
      })
    )
  }
)
