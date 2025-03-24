import { expect } from 'vitest'

import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('get sandbox info', async ({ sandbox }) => {
  const info = await sandbox.getInfo()
  expect(info).toBeDefined()
  expect(info.sandboxId).toBe(sandbox.sandboxId)
})
