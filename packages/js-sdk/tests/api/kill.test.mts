import { assert } from 'vitest'

import { sandboxTest } from '../setup.mjs'
import { Sandbox } from '../../src'

sandboxTest.skipIf(process.env.E2B_DEBUG)('kill existing sandbox', async ({ sandbox }) => {
  assert.doesNotThrow(() => Sandbox.kill(sandbox.sandboxID))
})

sandboxTest.skipIf(process.env.E2B_DEBUG)('kill non-existing sandbox', async () => {
  assert.throws(() => Sandbox.kill('non-existing-sandbox'))
})
