import { expect } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('kill', async ({ sandbox, sandboxTestId }) => {
  const killed = await sandbox.kill()
  expect(killed).toBe(true)

  const paginator = Sandbox.list({
    query: { state: ['running'], metadata: { sandboxTestId } },
  })
  const sandboxes = await paginator.nextItems()

  expect(sandboxes.map((s) => s.sandboxId)).not.toContain(sandbox.sandboxId)
})
