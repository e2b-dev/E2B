import { expect } from 'vitest'
import { isDebug, sandboxTest, secureSandboxTest } from './setup'

sandboxTest('basic', async ({ sandbox }) => {
  const result = await sandbox.runCode('x =1; x')

  expect(result.text).toEqual('1')
})

secureSandboxTest.skipIf(isDebug)('secure access', async ({ sandbox }) => {
  const result = await sandbox.runCode('x =1; x')

  expect(result.text).toEqual('1')
})
