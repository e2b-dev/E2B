import { assert } from 'vitest'

import { hostedSandboxTest } from '../setup.js'
import { Sandbox } from '../../src'

hostedSandboxTest('pause sandbox', async ({ sandbox }) => {
  await Sandbox.pause(sandbox.sandboxId)
  assert.isFalse(
    await sandbox.isRunning(),
    'Sandbox should not be running after pause'
  )
})

hostedSandboxTest('resume sandbox', async ({ sandbox }) => {
  await Sandbox.pause(sandbox.sandboxId)
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
