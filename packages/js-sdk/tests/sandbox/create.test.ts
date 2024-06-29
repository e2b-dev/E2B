import { test, assert } from 'vitest'

import { Sandbox } from '../../src'
import { template, isDebug } from '../setup.js'

test.skipIf(isDebug)('create', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 5_000 })
  const isRunning = await sbx.isRunning()
  assert.isTrue(isRunning)
})

test.skipIf(isDebug)('metadata', async () => {
  const metadata = {
    'test-key': 'test-value',
  }

  const sbx = await Sandbox.create(template, { timeoutMs: 5_000, metadata })

  const sbxs = await Sandbox.list()
  const sbxInfo = sbxs.find((s) => s.sandboxID === sbx.sandboxID)

  assert.deepEqual(sbxInfo?.metadata, metadata)
})
