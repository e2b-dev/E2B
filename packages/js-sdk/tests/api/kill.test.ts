import { expect } from 'vitest'

import { hostedSandboxTest } from '../setup.js'
import { Sandbox } from '../../src'

hostedSandboxTest(
  'kill existing sandbox',
  async ({ sandbox, sandboxTestId }) => {
    await Sandbox.kill(sandbox.sandboxId)

    const paginator = Sandbox.list({
      query: { state: ['running'], metadata: { sandboxTestId } },
    })
    const sandboxes = await paginator.nextItems()
    expect(sandboxes.map((s) => s.sandboxId)).not.toContain(sandbox.sandboxId)
  }
)

hostedSandboxTest('kill non-existing sandbox', async () => {
  await expect(Sandbox.kill('nonexistingsandbox')).resolves.toBe(false)
})
