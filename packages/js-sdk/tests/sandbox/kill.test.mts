import { assert } from 'vitest'

import { sandboxTest } from '../setup.mjs'

sandboxTest('kill', async ({ sandbox }) => {
  await sandbox.kill()

  assert.throws(() => sandbox.isRunning())
})
