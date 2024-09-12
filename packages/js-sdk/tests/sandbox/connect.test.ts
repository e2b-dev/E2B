import { assert, onTestFinished, test } from 'vitest'

import { FilesystemEvent, FilesystemEventType, Sandbox } from '../../src'
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

test.skipIf(isDebug)('connect with file creation handler', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 10_000 })
  const dirPath = '/new-dir2'
  onTestFinished(async () =>  await sbx.files.remove(dirPath))

  let trigger: () => void

  const eventPromise = new Promise<void>((resolve) => {
    trigger = resolve
  })

  const onFileCreation = async (e: FilesystemEvent) => {
    if (e.type === FilesystemEventType.CREATE && e.name === dirPath) {
      trigger()
    }
  }

  const isRunning = await sbx.isRunning()
  assert.isTrue(isRunning)

  const sbxConnection = await Sandbox.create(sbx.sandboxId, { onFileCreation})
  const isRunning2 = await sbxConnection.isRunning()
  assert.isTrue(isRunning2)

  const ok = await sbx.files.makeDir(dirPath)
  assert.isTrue(ok)

  await eventPromise
})
