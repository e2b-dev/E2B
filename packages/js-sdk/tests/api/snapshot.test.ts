import { assert } from 'vitest'
import { Sandbox } from '../../src'
import { sandboxTest } from '../setup'

sandboxTest('pause a sandbox', async ({ sandbox }) => {
  await Sandbox.pause(sandbox.sandboxId)
  assert.isTrue(await sandbox.isRunning())
})

sandboxTest('resume a sandbox', async ({ sandbox }) => {
  // pause
  await Sandbox.pause(sandbox.sandboxId)
  assert.isFalse(await sandbox.isRunning())

  // resume
  await Sandbox.resume(sandbox.sandboxId)
  assert.isTrue(await sandbox.isRunning())
})
