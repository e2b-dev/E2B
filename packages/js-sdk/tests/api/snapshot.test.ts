import { assert } from 'vitest'

import { sandboxTest, isDebug } from '../setup.js'
import { Sandbox } from '../../src'

sandboxTest.skipIf(isDebug)('pause sandbox', async ({ sandbox }) => {
  await Sandbox.betaPause(sandbox.sandboxId)
  assert.isFalse(
    await sandbox.isRunning(),
    'Sandbox should not be running after pause'
  )
})

sandboxTest.skipIf(isDebug)('resume sandbox', async ({ sandbox }) => {
  await Sandbox.betaPause(sandbox.sandboxId)
  assert.isFalse(
    await sandbox.isRunning(),
    'Sandbox should not be running after pause'
  )

  await Sandbox.connect(sandbox.sandboxId)
  assert.isTrue(
    await sandbox.isRunning(),
    'Sandbox should be running after resume'
  )
})
