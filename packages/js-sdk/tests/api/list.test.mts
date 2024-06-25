import { assert } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest } from '../setup.mjs'

sandboxTest.skipIf(process.env.E2B_DEBUG)('list sandboxes', async ({ sandbox }) => {
  const sandboxes = await Sandbox.list()
  assert.isAtLeast(sandboxes.length, 1)
  assert.include(sandboxes.map((s) => s.sandboxID), sandbox.sandboxID)
})
