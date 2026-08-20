import { expect } from 'vitest'

import { sandboxTest } from '../setup.js'
import { Sandbox } from '../../src'

sandboxTest('kill existing sandbox', async ({ sandbox, sandboxTestId }) => {
  await Sandbox.kill(sandbox.sandboxId)

  const paginator = Sandbox.list({
    query: { state: ['running'], metadata: { sandboxTestId } },
  })
  const sandboxes = await paginator.nextItems()
  expect(sandboxes.map((s) => s.sandboxId)).not.toContain(sandbox.sandboxId)
})

sandboxTest('kill non-existing sandbox', async () => {
  await expect(Sandbox.kill('nonexistingsandbox')).resolves.toBe(false)
})
