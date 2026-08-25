import { expect } from 'vitest'

import { isDebug, sandboxTest } from './setup'

// Skip this test if we are running in debug mode — the execution is persisted between all tests so the result is not reset.
sandboxTest.skipIf(isDebug)('statefulness', async ({ sandbox }) => {
  await sandbox.runCode('x = 1')

  const result = await sandbox.runCode('x += 1; x')

  expect(result.text).toEqual('2')
})
