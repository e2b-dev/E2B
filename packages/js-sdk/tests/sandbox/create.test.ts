import { assert, onTestFinished, test } from 'vitest'

import { FilesystemEvent, FilesystemEventType, Sandbox } from '../../src'
import { isDebug, template } from '../setup.js'

test.skipIf(isDebug)('create', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 5_000 })
  try {
    const isRunning = await sbx.isRunning()
    assert.isTrue(isRunning)
  } finally {
    await sbx.kill()
  }
})

test.skipIf(isDebug)('create with metadata', async () => {
  const metadata = {
    'test-key': 'test-value',
  }

  const sbx = await Sandbox.create(template, { timeoutMs: 5_000, metadata })

  try {
    const sbxs = await Sandbox.list()
    const sbxInfo = sbxs.find((s) => s.sandboxId === sbx.sandboxId)

    assert.deepEqual(sbxInfo?.metadata, metadata)
  } finally {
    await sbx.kill()
  }
})

test.skipIf(isDebug)('create with file creation handler', async () => {
  const dirPath = '/new-dir'

  let trigger: () => void

  const eventPromise = new Promise<void>((resolve) => {
    trigger = resolve
  })

  const onFileCreation = async (e: FilesystemEvent) => {
    if (e.type === FilesystemEventType.CREATE && e.name === dirPath) {
      trigger()
    }
  }
  const sbx = await Sandbox.create(template, { timeoutMs: 5_000, onFileCreation })
  onTestFinished(async () =>  await sbx.files.remove(dirPath))

  const ok = await sbx.files.makeDir(dirPath)
  assert.isTrue(ok)

  await eventPromise
})
