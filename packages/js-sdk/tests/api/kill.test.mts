import { expect } from 'vitest'

import { sandboxTest, isDebug } from '../setup.mjs'
import { Sandbox } from '../../src'

sandboxTest.skipIf(isDebug)('kill existing sandbox', async ({ sandbox }) => {
  await Sandbox.kill(sandbox.sandboxID)
})

sandboxTest.skipIf(isDebug)('kill non-existing sandbox', async () => {
  await expect(Sandbox.kill('non-existing-sandbox')).rejects.toThrowError()
})
