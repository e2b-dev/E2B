import { assert } from 'vitest'

import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('pause and resume a sandbox', async ({ sandbox }) => {
  assert.isTrue(await sandbox.isRunning())

  await sandbox.pause()

  assert.isFalse(await sandbox.isRunning())

  await sandbox.resume()

  assert.isTrue(await sandbox.isRunning())
})
