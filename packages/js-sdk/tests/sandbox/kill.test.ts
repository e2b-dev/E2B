import { expect } from 'vitest'

import { Sandbox, SandboxInfo } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('kill', async ({ sandbox }) => {
  await sandbox.kill()

  const listArray = await Sandbox.list()
  const list: SandboxInfo[] = []
  for await (const sbx of listArray) {
    list.push(sbx)
  }
  expect(list.map(s => s.sandboxId)).not.toContain(sandbox.sandboxId)
})
