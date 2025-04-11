import { expect } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('kill', async ({ sandbox }) => {
  await sandbox.kill()

  const { sandboxes } = await Sandbox.list({
    query: { state: ['running'] },
  })

  expect(sandboxes.map((s) => s.sandboxId)).not.toContain(sandbox.sandboxId)
})
