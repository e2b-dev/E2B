import { assert, test } from 'vitest'

import { Sandbox } from '../../src'
import { template, isDebug } from '../setup.js'

test.skipIf(isDebug)('create', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 5_000 })
  try {
    const isRunning = await sbx.isRunning()
    // @ts-ignore It's only for testing
    assert.isDefined(sbx.envdApi.version)
    assert.isTrue(isRunning)
  } finally {
    await sbx.kill()
  }
})

test.skipIf(isDebug)('metadata', async () => {
  const metadata = {
    'test-key': 'test-value',
  }

  const sbx = await Sandbox.create(template, { timeoutMs: 5_000, metadata })

  try {
    const paginator = Sandbox.list()
    const sbxs = await paginator.nextItems()
    const sbxInfo = sbxs.find((s) => s.sandboxId === sbx.sandboxId)

    assert.deepEqual(sbxInfo?.metadata, metadata)
  } finally {
    await sbx.kill()
  }
})
