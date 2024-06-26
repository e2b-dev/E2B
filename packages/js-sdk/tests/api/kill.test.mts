import { assert } from 'vitest'

import { sandboxTest, isDebug } from '../setup.mjs'
import { Sandbox } from '../../src'

sandboxTest.skipIf(isDebug)('kill existing sandbox', async ({ sandbox }) => {
  assert.doesNotThrow(() => Sandbox.kill(sandbox.sandboxID))
})

sandboxTest.skipIf(isDebug)('kill non-existing sandbox', async () => {
  assert.throws(() => Sandbox.kill('non-existing-sandbox'))
})
