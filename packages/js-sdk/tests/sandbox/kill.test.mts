import { assert } from 'vitest'

import { sandboxTest, isDebug } from '../setup.mjs'

sandboxTest.skipIf(isDebug)('kill', async ({ sandbox }) => {
  await sandbox.kill()

  assert.throws(() => sandbox.isRunning())
})
