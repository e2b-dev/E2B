import { expect } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('kill', async ({ sandbox }) => {
  await sandbox.kill()

  const list = await Sandbox.list()
  expect(list.map(s => s.sandboxID)).not.toContain(sandbox.sandboxID)
})
