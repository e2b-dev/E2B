import { expect } from 'vitest'

import { sandboxTest } from './setup'

sandboxTest('create new kernel', async ({ sandbox }) => {
  await sandbox.createCodeContext()
})

sandboxTest('independence of kernels', async ({ sandbox }) => {
  await sandbox.runCode('x = 1')
  const context = await sandbox.createCodeContext()
  const output = await sandbox.runCode('x', { context })

  expect(output.error!.value).toEqual("name 'x' is not defined")
})

sandboxTest('pass context and language', async ({ sandbox }) => {
  const context = await sandbox.createCodeContext()
  await expect(
    sandbox.runCode({ context, language: 'python' })
  ).rejects.toThrowError()
})
