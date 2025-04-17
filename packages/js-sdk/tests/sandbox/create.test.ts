import { assert, expect, test } from 'vitest'

import { Sandbox } from '../../src'
import { isDebug, template, wait } from '../setup.js'

test.skipIf(isDebug)('create', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 5_000, autoPause: true })
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

  const sbx = await Sandbox.create(template, { timeoutMs: 5_000, metadata, autoPause: true })

  try {
    const sbxs = await Sandbox.list()
    const sbxInfo = sbxs.find((s) => s.sandboxId === sbx.sandboxId)

    assert.deepEqual(sbxInfo?.metadata, metadata)
  } finally {
    await sbx.kill()
  }
})

test.skipIf(isDebug)('auto pause', async () => {
  const timeout = 1_000
  const sbx = await Sandbox.create(template, { timeoutMs: timeout, autoPause: true })
  await sbx.files.write('test.txt', 'test')

  // Wait for the sandbox to pause and create snapshot
  await wait(timeout + 5_000)

  const sbxResumed = await Sandbox.connect(sbx.sandboxId, { timeoutMs: 5_000, autoPause: true })

  try {
    await expect(sbxResumed.files.read('test.txt')).resolves.toEqual('test')
  } finally {
    await sbxResumed.kill()
  }
})
