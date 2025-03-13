import { assert } from 'vitest'

import { Sandbox, SandboxInfo } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('list sandboxes', async ({ sandbox }) => {
  const sandboxesList = await Sandbox.list()
  const sandboxes: SandboxInfo[] = []
  for await (const sbx of sandboxesList) {
    sandboxes.push(sbx)
  }

  assert.isAtLeast(sandboxes.length, 1)
  assert.include(
    sandboxes.map((s) => s.sandboxId),
    sandbox.sandboxId
  )

  // Check that sandboxes are sorted by startedAt in descending order (newest first)
  for (let i = 0; i < sandboxes.length - 1; i++) {
    assert.isAtLeast(
      new Date(sandboxes[i + 1].startedAt).getTime(),
      new Date(sandboxes[i].startedAt).getTime(),
      'Sandboxes should be sorted by startedAt in descending order'
    )
  }
})

sandboxTest.skipIf(isDebug)('list sandboxes with filter', async () => {
  const uniqueId = Date.now().toString()
  // Create an extra sandbox with a uniqueId
  const extraSbx = await Sandbox.create({})
  try {
    const sbx = await Sandbox.create({ metadata: { uniqueId: uniqueId } })
    try {
      const sandboxesList = await Sandbox.list({ filters: { uniqueId } })
      const sandboxes: SandboxInfo[] = []
      for await (const sbx of sandboxesList) {
        sandboxes.push(sbx)
      }

      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].sandboxId, sbx.sandboxId)
    } finally {
      await sbx.kill()
    }
  } finally {
    await extraSbx.kill()
  }
})

sandboxTest.skipIf(isDebug)('list paused sandboxes', async ({ sandbox }) => {
  const pausedSandbox = await sandbox.pause()
  const pausedSandboxId = pausedSandbox.split('-')[0] + '-' + '00000000'
  const sandboxesList = await Sandbox.list({ state: ['paused'] })
  const sandboxes: SandboxInfo[] = []
  for await (const sbx of sandboxesList) {
    sandboxes.push(sbx)
  }

  assert.isAtLeast(sandboxes.length, 1)
  assert.include(
    sandboxes.map((s) => s.sandboxId),
    pausedSandboxId
  )
})
