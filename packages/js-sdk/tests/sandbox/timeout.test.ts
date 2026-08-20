import { expect } from 'vitest'

import { sandboxTest, wait } from '../setup.js'

sandboxTest('shorten timeout', async ({ sandbox }) => {
  await sandbox.setTimeout(5000)

  await wait(6000)

  expect(await sandbox.isRunning()).toBeFalsy()
})

sandboxTest('shorten then lengthen timeout', async ({ sandbox }) => {
  await sandbox.setTimeout(5000)

  await wait(1000)

  await sandbox.setTimeout(10000)

  await wait(6000)

  expect(await sandbox.isRunning()).toBeTruthy()
})

sandboxTest('get sandbox timeout', async ({ sandbox }) => {
  const { endAt } = await sandbox.getInfo()
  expect(endAt).toBeInstanceOf(Date)
})
