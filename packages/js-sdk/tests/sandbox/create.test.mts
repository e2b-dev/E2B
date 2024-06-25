import { test, assert } from 'vitest'

import { Sandbox } from '../../src'
import { template } from '../setup.mjs'

test('create', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 5_000 })
  const isRunning = await sbx.isRunning()
  assert.isTrue(isRunning)
})
