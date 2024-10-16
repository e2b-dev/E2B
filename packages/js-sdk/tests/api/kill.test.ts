import { expect } from 'vitest'

import { sandboxTest, isDebug } from '../setup.js'
import { Sandbox } from '../../src'

sandboxTest.skipIf(isDebug)('kill existing sandbox', async ({ sandbox }) => {
  await Sandbox.kill(sandbox.sandboxId)

  const list = await Sandbox.list()
  expect(list.map(s => s.sandboxId)).not.toContain(sandbox.sandboxId)
})

sandboxTest.skipIf(isDebug)('kill non-existing sandbox', async () => {
  await expect(Sandbox.kill('non-existing-sandbox')).resolves.toBe(false)
})
