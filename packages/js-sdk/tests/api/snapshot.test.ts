import { assert } from 'vitest'
import { Sandbox } from '../../src'
import { sandboxTest } from '../setup'

sandboxTest('pause a sandbox', async ({ sandbox }) => {
  const sandboxId = sandbox.sandboxId
  await Sandbox.pause(sandboxId)
  assert.isTrue(await sandbox.isRunning())
})

sandboxTest('resume a sandbox', async ({ sandbox }) => {
  // pause
  const sandboxId = sandbox.sandboxId
  await Sandbox.pause(sandboxId)
  assert.isFalse(await sandbox.isRunning())

  // resume
  await Sandbox.resume(sandboxId)
  assert.isTrue(await sandbox.isRunning())
})
