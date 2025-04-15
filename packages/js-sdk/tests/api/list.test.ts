import { assert } from 'vitest'

import { Sandbox, SandboxInfo } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)(
  'list sandboxes',
  async ({ sandbox, sandboxType }) => {
    const paginator = Sandbox.list({
      query: { metadata: { sandboxType } },
    })
    const sandboxes = await paginator.nextItems()

    assert.isAtLeast(sandboxes.length, 1)

    const found = sandboxes.some((s) => s.sandboxId === sandbox.sandboxId)
    assert.isTrue(found)
  }
)

sandboxTest.skipIf(isDebug)(
  'list sandboxes with filter',
  async ({ sandboxType }) => {
    const uniqueId = Date.now().toString()
    const extraSbx = await Sandbox.create({ metadata: { uniqueId } })

    try {
      const paginator = Sandbox.list({
        query: { metadata: { uniqueId } },
      })
      const sandboxes = await paginator.nextItems()

      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].sandboxId, extraSbx.sandboxId)
    } finally {
      await extraSbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'list running sandboxes',
  async ({ sandboxType }) => {
    const extraSbx = await Sandbox.create({ metadata: { sandboxType } })

    try {
      const paginator = Sandbox.list({
        query: { metadata: { sandboxType }, state: ['running'] },
      })
      const sandboxes = await paginator.nextItems()

      assert.isAtLeast(sandboxes.length, 1)

      // Verify our running sandbox is in the list
      const found = sandboxes.some(
        (s) => s.sandboxId === extraSbx.sandboxId && s.state === 'running'
      )
      assert.isTrue(found)
    } finally {
      await extraSbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'list paused sandboxes',
  async ({ sandboxType }) => {
    // Create and pause a sandbox
    const extraSbx = await Sandbox.create({ metadata: { sandboxType } })
    await extraSbx.pause()

    try {
      const paginator = Sandbox.list({
        query: { metadata: { sandboxType }, state: ['paused'] },
      })
      const sandboxes = await paginator.nextItems()

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
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate running sandboxes',
  async ({ sandbox, sandboxType }) => {
    // Create extra sandboxes
    const extraSbx = await Sandbox.create({ metadata: { sandboxType } })

    try {
      // Test pagination with limit
      const paginator = Sandbox.list({
        limit: 1,
        query: { metadata: { sandboxType }, state: ['running'] },
      })
      const sandboxes = await paginator.nextItems()

      // Check first page
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].state, 'running')
      assert.isTrue(paginator.hasNext)
      assert.notEqual(paginator.nextToken, undefined)
      assert.equal(sandboxes[0].sandboxId, extraSbx.sandboxId)

      // Get second page
      const sandboxes2 = await paginator.nextItems()

      // Check second page
      assert.equal(sandboxes2.length, 1)
      assert.equal(sandboxes2[0].state, 'running')
      assert.isFalse(paginator.hasNext)
      assert.equal(paginator.nextToken, undefined)
      assert.equal(sandboxes2[0].sandboxId, sandbox.sandboxId)
    } finally {
      await extraSbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate paused sandboxes',
  async ({ sandbox, sandboxType }) => {
    const sandboxId = sandbox.sandboxId.split('-')[0]
    await sandbox.pause()

    // Create extra paused sandbox
    const extraSbx = await Sandbox.create({ metadata: { sandboxType } })
    await extraSbx.pause()
    const extraSbxId = extraSbx.sandboxId.split('-')[0]

    try {
      // Test pagination with limit
      const paginator = Sandbox.list({
        limit: 1,
        query: { metadata: { sandboxType }, state: ['paused'] },
      })
      const sandboxes = await paginator.nextItems()

      // Check first page
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].state, 'paused')
      assert.isTrue(paginator.hasNext)
      assert.notEqual(paginator.nextToken, undefined)
      assert.equal(sandboxes[0].sandboxId.startsWith(extraSbxId), true)

      // Get second page
      const sandboxes2 = await paginator.nextItems()

      // Check second page
      assert.equal(sandboxes2.length, 1)
      assert.equal(sandboxes2[0].state, 'paused')
      assert.isFalse(paginator.hasNext)
      assert.equal(paginator.nextToken, undefined)
      assert.equal(sandboxes2[0].sandboxId.startsWith(extraSbxId), true)
    } finally {
      await extraSbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate running and paused sandboxes',
  async ({ sandbox, sandboxType }) => {
    // Create extra sandbox
    const extraSbx = await Sandbox.create({ metadata: { sandboxType } })
    const extraSbxId = extraSbx.sandboxId.split('-')[0]

    // Pause the extra sandbox
    await extraSbx.pause()

    try {
      // Test pagination with limit
      const paginator = Sandbox.list({
        limit: 1,
        query: {
          metadata: { sandboxType },
          state: ['running', 'paused'],
        },
      })
      const sandboxes = await paginator.nextItems()

      // Check first page
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].state, 'paused')
      assert.isTrue(paginator.hasNext)
      assert.notEqual(paginator.nextToken, undefined)
      assert.equal(sandboxes[0].sandboxId.startsWith(extraSbxId), true)

      // Get second page
      const sandboxes2 = await paginator.nextItems()

      // Check second page
      assert.equal(sandboxes2.length, 1)
      assert.equal(sandboxes2[0].state, 'running')
      assert.isFalse(paginator.hasNext)
      assert.equal(paginator.nextToken, undefined)
      assert.equal(sandboxes2[0].sandboxId, sandbox.sandboxId)
    } finally {
      await extraSbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate iterator',
  async ({ sandbox, sandboxType }) => {
    const paginator = Sandbox.list({
      query: { metadata: { sandboxType } },
    })
    const sandboxes: SandboxInfo[] = []

    while (paginator.hasNext) {
      const sbxs = await paginator.nextItems()
      sandboxes.push(...sbxs)
    }

    assert.isAtLeast(sandboxes.length, 1)
    assert.isTrue(sandboxes.some((s) => s.sandboxId === sandbox.sandboxId))
  }
)
