import { expect } from 'vitest'

import { sandboxTest, isDebug } from '../setup.js'
import { Sandbox } from '../../src'

sandboxTest.skipIf(isDebug)('get sandbox info', async ({ sandbox }) => {
  const info = await Sandbox.getInfo(sandbox.sandboxId)
  expect(info).toBeDefined()
  expect(info.sandboxId).toBe(sandbox.sandboxId)
})
