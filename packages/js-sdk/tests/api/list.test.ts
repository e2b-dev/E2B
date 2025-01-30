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
})

sandboxTest.skipIf(isDebug)('list paused sandboxes', async ({ sandbox }) => {
  const pausedSandbox = await sandbox.pause()
  const sandboxes = await Sandbox.list({ state: 'paused' })
  assert.isAtLeast(sandboxes.length, 1)
  assert.include(
    sandboxes.map((s) => s.sandboxId),
    sandbox.sandboxId
  )
})
