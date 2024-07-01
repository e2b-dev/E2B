import { expect } from 'vitest'

import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('kill', async ({ sandbox }) => {
  await sandbox.kill()

  await expect(sandbox.isRunning()).rejects.toThrowError()
})
