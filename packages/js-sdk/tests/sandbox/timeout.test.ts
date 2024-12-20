import { expect } from 'vitest'

import { sandboxTest, isDebug, wait } from '../setup.js'

sandboxTest.skipIf(isDebug)('shorten timeout', async ({ sandbox }) => {
  await sandbox.setTimeout(5000)

  await wait(6000)

  expect(await sandbox.isRunning({ requestTimeoutMs: 1000 })).toBeFalsy()
})

sandboxTest.skipIf(isDebug)(
  'shorten then lenghten timeout',
  async ({ sandbox }) => {
    await sandbox.setTimeout(5000)

    await wait(1000)

    await sandbox.setTimeout(10000)

    await wait(6000)

    await sandbox.isRunning()
  }
)

sandboxTest.skipIf(isDebug)('get sandbox timeout', async ({ sandbox }) => {
  const timeout = await sandbox.getTimeout()
  expect(timeout).toBeDefined()
})
