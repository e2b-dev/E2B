import { expect } from 'vitest'

import { hostedSandboxTest } from '../setup.js'
import { Sandbox } from '../../src'

hostedSandboxTest('get sandbox info', async ({ sandbox }) => {
  const info = await Sandbox.getInfo(sandbox.sandboxId)
  expect(info).toBeDefined()
  expect(info.sandboxId).toBe(sandbox.sandboxId)
})
