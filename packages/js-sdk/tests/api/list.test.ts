import { assert } from 'vitest'

import { Sandbox, SandboxInfo } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)(
  'list sandboxes',
  async ({ sandbox, sandboxTestId }) => {
    const paginator = Sandbox.list({
      query: { metadata: { sandboxTestId } },
    })
    const sandboxes = await paginator.nextItems()

    assert.isAtLeast(sandboxes.length, 1)

    const found = sandboxes.some((s) => s.sandboxId === sandbox.sandboxId)
    assert.isTrue(found)
  }
)

sandboxTest.skipIf(isDebug)('list sandboxes with filter', async () => {
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
})

sandboxTest.skipIf(isDebug)(
  'list running sandboxes',
  async ({ sandboxTestId }) => {
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })

    try {
      const paginator = Sandbox.list({
        query: { metadata: { sandboxTestId }, state: ['running'] },
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
  async ({ sandboxTestId }) => {
    // Create and pause a sandbox
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })
    await extraSbx.betaPause()

    try {
      const paginator = Sandbox.list({
        query: { metadata: { sandboxTestId }, state: ['paused'] },
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
  async ({ sandbox, sandboxTestId }) => {
    // Create extra sandboxes
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })

    try {
      // Test pagination with limit
      const paginator = Sandbox.list({
        limit: 1,
        query: { metadata: { sandboxTestId }, state: ['running'] },
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
  async ({ sandbox, sandboxTestId }) => {
    const sandboxId = sandbox.sandboxId.split('-')[0]
    await sandbox.betaPause()

    // Create extra paused sandbox
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })
    await extraSbx.betaPause()
    const extraSbxId = extraSbx.sandboxId.split('-')[0]

    try {
      // Test pagination with limit
      const paginator = Sandbox.list({
        limit: 1,
        query: { metadata: { sandboxTestId }, state: ['paused'] },
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
      assert.equal(sandboxes2[0].sandboxId.startsWith(sandboxId), true)
    } finally {
      await extraSbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate running and paused sandboxes',
  async ({ sandbox, sandboxTestId }) => {
    // Create extra sandbox
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })
    const extraSbxId = extraSbx.sandboxId.split('-')[0]

    // Pause the extra sandbox
    await extraSbx.betaPause()

    try {
      // Test pagination with limit
      const paginator = Sandbox.list({
        limit: 1,
        query: {
          metadata: { sandboxTestId },
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
  async ({ sandbox, sandboxTestId }) => {
    const paginator = Sandbox.list({
      query: { metadata: { sandboxTestId } },
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

sandboxTest.skipIf(isDebug)(
  'list sandboxes',
  async ({ sandbox, sandboxTestId }) => {
    const paginator = Sandbox.list({
      query: { metadata: { sandboxTestId } },
    })
    const sandboxes = await paginator.nextItems()

    assert.isAtLeast(sandboxes.length, 1)

    const found = sandboxes.some((s) => s.sandboxId === sandbox.sandboxId)
    assert.isTrue(found)
  }
)

sandboxTest.skipIf(isDebug)('list sandboxes with filter', async () => {
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
})

sandboxTest.skipIf(isDebug)(
  'list running sandboxes',
  async ({ sandboxTestId }) => {
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })

    try {
      const paginator = Sandbox.list({
        query: { metadata: { sandboxTestId }, state: ['running'] },
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
  async ({ sandboxTestId }) => {
    // Create and pause a sandbox
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })
    await Sandbox.betaPause(extraSbx.sandboxId)

    try {
      const paginator = Sandbox.list({
        query: { metadata: { sandboxTestId }, state: ['paused'] },
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
  async ({ sandbox, sandboxTestId }) => {
    // Create extra sandboxes
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })

    try {
      // Test pagination with limit
      const paginator = Sandbox.list({
        limit: 1,
        query: { metadata: { sandboxTestId }, state: ['running'] },
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
  async ({ sandbox, sandboxTestId }) => {
    await Sandbox.betaPause(sandbox.sandboxId)

    // Create extra paused sandbox
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })
    await Sandbox.betaPause(extraSbx.sandboxId)
    const extraSbxId = extraSbx.sandboxId.split('-')[0]

    try {
      // Test pagination with limit
      const paginator = Sandbox.list({
        limit: 1,
        query: { metadata: { sandboxTestId }, state: ['paused'] },
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
      assert.equal(sandboxes2[0].sandboxId, sandbox.sandboxId)
    } finally {
      await extraSbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate running and paused sandboxes',
  async ({ sandbox, sandboxTestId }) => {
    // Create extra sandbox
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })
    const extraSbxId = extraSbx.sandboxId.split('-')[0]

    // Pause the extra sandbox
    await Sandbox.betaPause(sandbox.sandboxId)

    try {
      // Test pagination with limit
      const paginator = Sandbox.list({
        limit: 1,
        query: {
          metadata: { sandboxTestId },
          state: ['running', 'paused'],
        },
      })
      const sandboxes = await paginator.nextItems()

      // Check first page
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].state, 'running')

      assert.isTrue(paginator.hasNext)
      assert.notEqual(paginator.nextToken, undefined)
      assert.equal(sandboxes[0].sandboxId, extraSbxId)

      // Get second page
      const sandboxes2 = await paginator.nextItems()

      // Check second page
      assert.equal(sandboxes2.length, 1)
      assert.equal(sandboxes2[0].state, 'paused')
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
  async ({ sandbox, sandboxTestId }) => {
    const paginator = Sandbox.list({
      query: { metadata: { sandboxTestId } },
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
