import { assert } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('list sandboxes', async ({ sandbox }) => {
  const sandboxes = await Sandbox.list()
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
  const extraSbx = await Sandbox.create({ })
  try {
    const sbx = await Sandbox.create({metadata: {uniqueId: uniqueId}})
    try {
      const sandboxes = await Sandbox.list({filters: {uniqueId}})
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].sandboxId, sbx.sandboxId)
    } finally {
      await sbx.kill()
    }
  } finally {
    await extraSbx.kill()
  }
})
