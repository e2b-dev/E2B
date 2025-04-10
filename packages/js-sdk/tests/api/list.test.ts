import { assert } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('list sandboxes', async ({ sandbox }) => {
  const { sandboxes } = await Sandbox.list()

  assert.isAtLeast(sandboxes.length, 1)

  const found = sandboxes.some((s) => s.sandboxId === sandbox.sandboxId)
  assert.isTrue(found)
})

sandboxTest.skipIf(isDebug)('list sandboxes with filter', async () => {
  const uniqueId = Date.now().toString()
  const extraSbx = await Sandbox.create({ metadata: { uniqueId } })

  try {
    const { sandboxes } = await Sandbox.list({
      query: { metadata: { uniqueId } },
    })

    assert.equal(sandboxes.length, 1)
    assert.equal(sandboxes[0].sandboxId, extraSbx.sandboxId)
  } finally {
    await extraSbx.kill()
  }
})

sandboxTest.skipIf(isDebug)('list running sandboxes', async ({ sandbox }) => {
  const extraSbx = await Sandbox.create({ metadata: { sandboxType: 'test' } })

  try {
    const { sandboxes } = await Sandbox.list({
      state: ['running'],
      query: { metadata: { sandboxType: 'test' } },
    })

    assert.isAtLeast(sandboxes.length, 1)

    // Verify our running sandbox is in the list
    const found = sandboxes.some(
      (s) => s.sandboxId === extraSbx.sandboxId && s.state === 'running'
    )
    assert.isTrue(found)
  } finally {
    await extraSbx.kill()
  }
})

sandboxTest.skipIf(isDebug)('list paused sandboxes', async ({ sandbox }) => {
  // Create and pause a sandbox
  const extraSbx = await Sandbox.create({ metadata: { sandboxType: 'test' } })
  await extraSbx.pause()

  try {
    const { sandboxes } = await Sandbox.list({
      state: ['paused'],
      query: { metadata: { sandboxType: 'test' } },
    })

    assert.isAtLeast(sandboxes.length, 1)

    // Verify our paused sandbox is in the list
    const pausedSandboxId = extraSbx.sandboxId.split('-')[0]
    const found = sandboxes.some(
      (s) => s.sandboxId.startsWith(pausedSandboxId) && s.state === 'paused'
    )
    assert.isTrue(found)
  } finally {
    await extraSbx.kill()
  }
})

sandboxTest.skipIf(isDebug)(
  'paginate running sandboxes',
  async ({ sandbox }) => {
    // Create two sandboxes
    const sandbox1 = await Sandbox.create({ metadata: { sandboxType: 'test' } })
    const sandbox2 = await Sandbox.create({ metadata: { sandboxType: 'test' } })

    try {
      // Test pagination with limit
      const { sandboxes, hasMoreItems, nextToken } = await Sandbox.list({
        limit: 1,
        state: ['running'],
        query: { metadata: { sandboxType: 'test' } },
      })

      // Check first page
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].state, 'running')
      assert.isTrue(hasMoreItems)
      assert.notEqual(nextToken, undefined)
      assert.equal(sandboxes[0].sandboxId, sandbox2.sandboxId)

      // Get second page using the next token
      const {
        sandboxes: sandboxes2,
        hasMoreItems: hasMoreItems2,
        nextToken: nextToken2,
      } = await Sandbox.list({
        limit: 1,
        nextToken: nextToken,
        state: ['running'],
        query: { metadata: { sandboxType: 'test' } },
      })

      // Check second page
      assert.equal(sandboxes2.length, 1)
      assert.equal(sandboxes2[0].state, 'running')
      assert.isFalse(hasMoreItems2)
      assert.equal(nextToken2, undefined)
      assert.equal(sandboxes2[0].sandboxId, sandbox1.sandboxId)
    } finally {
      await sandbox1.kill()
      await sandbox2.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate paused sandboxes',
  async ({ sandbox }) => {
    // Create two paused sandboxes
    const sandbox1 = await Sandbox.create({ metadata: { sandboxType: 'test' } })
    const sandbox1Id = sandbox1.sandboxId.split('-')[0]
    await sandbox1.pause()

    const sandbox2 = await Sandbox.create({ metadata: { sandboxType: 'test' } })
    const sandbox2Id = sandbox2.sandboxId.split('-')[0]
    await sandbox2.pause()

    try {
      // Test pagination with limit
      const { sandboxes, hasMoreItems, nextToken } = await Sandbox.list({
        limit: 1,
        state: ['paused'],
        query: { metadata: { sandboxType: 'test' } },
      })

      // Check first page
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].state, 'paused')
      assert.isTrue(hasMoreItems)
      assert.notEqual(nextToken, undefined)
      assert.equal(sandboxes[0].sandboxId.startsWith(sandbox2Id), true)

      // Get second page using the next token
      const {
        sandboxes: sandboxes2,
        hasMoreItems: hasMoreItems2,
        nextToken: nextToken2,
      } = await Sandbox.list({
        limit: 1,
        nextToken: nextToken,
        state: ['paused'],
        query: { metadata: { sandboxType: 'test' } },
      })

      // Check second page
      assert.equal(sandboxes2.length, 1)
      assert.equal(sandboxes2[0].state, 'paused')
      assert.isFalse(hasMoreItems2)
      assert.equal(nextToken2, undefined)
      assert.equal(sandboxes2[0].sandboxId.startsWith(sandbox1Id), true)
    } finally {
      await sandbox1.kill()
      await sandbox2.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate running and paused sandboxes',
  async ({ sandbox }) => {
    // Create two sandboxes
    const sandbox1 = await Sandbox.create({ metadata: { sandboxType: 'test' } })
    const sandbox2 = await Sandbox.create({ metadata: { sandboxType: 'test' } })
    const sandbox2Id = sandbox2.sandboxId.split('-')[0]

    // Pause the second sandbox
    await sandbox2.pause()

    try {
      // Test pagination with limit
      const { sandboxes, hasMoreItems, nextToken } = await Sandbox.list({
        limit: 1,
        state: ['running', 'paused'],
        query: { metadata: { sandboxType: 'test' } },
      })

      // Check first page
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].state, 'paused')
      assert.isTrue(hasMoreItems)
      assert.notEqual(nextToken, undefined)
      assert.equal(sandboxes[0].sandboxId.startsWith(sandbox2Id), true)

      // Get second page using the next token
      const {
        sandboxes: sandboxes2,
        hasMoreItems: hasMoreItems2,
        nextToken: nextToken2,
      } = await Sandbox.list({
        limit: 1,
        nextToken: nextToken,
        state: ['running', 'paused'],
        query: { metadata: { sandboxType: 'test' } },
      })

      // Check second page
      assert.equal(sandboxes2.length, 1)
      assert.equal(sandboxes2[0].state, 'running')
      assert.isFalse(hasMoreItems2)
      assert.equal(nextToken2, undefined)
      assert.equal(sandboxes2[0].sandboxId, sandbox1.sandboxId)
    } finally {
      await sandbox1.kill()
      await sandbox2.kill()
    }
  }
)
