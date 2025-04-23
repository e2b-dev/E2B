import { test, assert } from 'vitest'

import { Sandbox } from '../../src'
import { isDebug, template } from '../setup.js'

test('connect', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 10_000, autoPause: true })

  try {
    const isRunning = await sbx.isRunning()
    assert.isTrue(isRunning)

    const sbxConnection = await Sandbox.connect(sbx.sandboxId, {autoPause: true})
    const isRunning2 = await sbxConnection.isRunning()
    assert.isTrue(isRunning2)
  } finally {
    if (!isDebug) {
      await sbx.kill()
    }
  }
})
