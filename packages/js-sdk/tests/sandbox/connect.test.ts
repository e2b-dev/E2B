import { test, assert } from 'vitest'

import { Sandbox } from '../../src'
import { template } from '../setup.js'

test('connect', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 10_000 })

  try {
    const isRunning = await sbx.isRunning()
    assert.isTrue(isRunning)

    const sbxConnection = await Sandbox.connect(sbx.sandboxId)
    const isRunning2 = await sbxConnection.isRunning()
    assert.isTrue(isRunning2)
  } finally {
    await sbx.kill()
  }
})
