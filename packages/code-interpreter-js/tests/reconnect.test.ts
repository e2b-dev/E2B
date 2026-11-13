import { expect } from 'vitest'

import { Sandbox } from '../src'
import { isDebug, sandboxTest } from './setup'

sandboxTest.skipIf(isDebug)('reconnect', async ({ sandbox }) => {
  sandbox = await Sandbox.connect(sandbox.sandboxId)

  const result = await sandbox.runCode('x =1; x')

  expect(result.text).toEqual('1')
})
