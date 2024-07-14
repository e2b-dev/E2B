import { expect } from 'vitest'

import { sandboxTest, isDebug, wait } from '../setup.js'

// SKIPPED: isRunning takes too long if the sandbox was just killed
sandboxTest.skipIf(isDebug).skip('shorten timeout', async ({ sandbox }) => {
  await sandbox.setTimeout(5000)

  await wait(6000)

  await expect(sandbox.isRunning({ requestTimeoutMs: 1000 })).rejects.toThrowError()
})

sandboxTest.skipIf(isDebug)('shorten then lenghten timeout', async ({ sandbox }) => {
  await sandbox.setTimeout(5000)

  await wait(1000)

  await sandbox.setTimeout(10000)

  await wait(6000)

  await sandbox.isRunning()
})