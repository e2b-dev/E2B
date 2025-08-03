import { expect } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('kill', async ({ sandbox, sandboxType }) => {
  await sandbox.kill()

  const paginator = Sandbox.list({
    query: { state: ['running'], metadata: { sandboxType } },
  })
  const sandboxes = await paginator.nextItems()

  expect(sandboxes.map((s) => s.sandboxId)).not.toContain(sandbox.sandboxId)
})
