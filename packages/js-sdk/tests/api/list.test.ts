import { assert } from 'vitest'

import { Sandbox } from '../../src'
import { isDebug, sandboxTest } from '../setup.js'

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
