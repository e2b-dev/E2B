import { expect } from 'vitest'

import { isDebug, sandboxTest } from './setup'

// Skip this test if we are running in debug mode — the pwd and user in the testing docker container are not the same as in the actual sandbox.
sandboxTest.skipIf(isDebug)('bash', async ({ sandbox }) => {
  const result = await sandbox.runCode('!pwd')

  expect(result.logs.stdout.join().trim()).toEqual('/home/user')
})
