import { expect } from 'vitest'

import { sandboxTest, isDebug, wait } from '../setup.mjs'

sandboxTest.skipIf(isDebug)('shorten timeout', async ({ sandbox }) => {
  await sandbox.setTimeout(5000)

  await wait(6000)

  await expect(sandbox.isRunning()).rejects.toThrowError()
})

sandboxTest.skipIf(isDebug)('shorten then lenghten timeout', async ({ sandbox }) => {
  await sandbox.setTimeout(5000)

  await wait(1000)

  await sandbox.setTimeout(10000)

  await wait(6000)

  await sandbox.isRunning()
})
