import { expect } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('kill', async ({ sandbox }) => {
  await sandbox.kill()

  const list = await Sandbox.list()
  expect(list.map((s) => s.sandboxId)).not.toContain(sandbox.sandboxId)
})

sandboxTest.skipIf(isDebug)('kill paused sandbox', async ({ sandbox }) => {
  const pausedSandbox = await sandbox.pause()
  await sandbox.kill()
  const pausedSandboxId = pausedSandbox.split('-')[0] + '-' + '00000000'

  const list = await Sandbox.list()
  expect(list.map((s) => s.sandboxId)).not.toContain(pausedSandboxId)
})
