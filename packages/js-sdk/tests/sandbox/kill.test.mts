import { expect } from 'vitest'

import { sandboxTest, isDebug } from '../setup.mjs'

sandboxTest.skipIf(isDebug)('kill', async ({ sandbox }) => {
  await sandbox.kill()

  await expect(sandbox.isRunning()).rejects.toThrowError()
})
