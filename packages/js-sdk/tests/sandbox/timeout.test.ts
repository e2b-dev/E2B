import { expect } from 'vitest'

import { hostedSandboxTest, wait } from '../setup.js'

hostedSandboxTest('shorten timeout', async ({ sandbox }) => {
  await sandbox.setTimeout(5000)

  await wait(6000)

  expect(await sandbox.isRunning()).toBeFalsy()
})

hostedSandboxTest('shorten then lengthen timeout', async ({ sandbox }) => {
  await sandbox.setTimeout(5000)

  await wait(1000)

  await sandbox.setTimeout(10000)

  await wait(6000)

  expect(await sandbox.isRunning()).toBeTruthy()
})

hostedSandboxTest('get sandbox timeout', async ({ sandbox }) => {
  const { endAt } = await sandbox.getInfo()
  expect(endAt).toBeInstanceOf(Date)
})
