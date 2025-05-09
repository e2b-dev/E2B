import { assert } from 'vitest'

import { Sandbox } from '../../src'
import { isDebug, sandboxTest, template } from '../setup.js'

sandboxTest.skipIf(isDebug)('list sandboxes', async ({ sandbox }) => {
  const sandboxes = await Sandbox.list()
  assert.isAtLeast(sandboxes.length, 1)
  assert.include(
    sandboxes.map((s) => s.sandboxId),
    sandbox.sandboxId
  )
})

sandboxTest.skipIf(isDebug)('list sandboxes with metadata filter', async () => {
  const uniqueId = Date.now().toString()
  // Create an extra sandbox with a uniqueId
  const extraSbx = await Sandbox.create(template)
  try {
    const sbx = await Sandbox.create(template, { metadata: { uniqueId: uniqueId } })
    try {
      const sandboxes = await Sandbox.list({ query: { metadata: { uniqueId } } })
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].sandboxId, sbx.sandboxId)
    } finally {
      await sbx.kill()
    }
  } finally {
    await extraSbx.kill()
  }
})

sandboxTest.skipIf(isDebug)('list sandboxes empty filter', async ({ sandbox }) => {
  const sandboxes = await Sandbox.list()
  assert.isAtLeast(sandboxes.length, 1)
  assert.include(
    sandboxes.map((s) => s.sandboxId),
    sandbox.sandboxId
  )
})
