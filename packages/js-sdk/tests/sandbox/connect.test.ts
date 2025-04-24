import { assert, test } from 'vitest'

import { Sandbox } from '../../src'
import { isDebug, template } from '../setup.js'

test('connect', async () => {
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

test('connect to non-running sandbox', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 10_000 })
  let isKilled = false

  try {
    const isRunning = await sbx.isRunning()
    assert.isTrue(isRunning)
    await sbx.kill()
    isKilled = true

    const sbxConnection = await Sandbox.connect(sbx.sandboxId)
    const isRunning2 = await sbxConnection.isRunning()
    assert.isFalse(isRunning2)
  } finally {
    if (!isKilled) {
      await sbx.kill()
    }
  }
})
