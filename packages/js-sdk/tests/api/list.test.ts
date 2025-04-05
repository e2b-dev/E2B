import { assert } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)('list sandboxes', async ({ sandbox }) => {
  const { sandboxes } = await Sandbox.list()

  assert.isAtLeast(sandboxes.length, 1)
  assert.include(
    sandboxes.map((s) => s.sandboxId),
    sandbox.sandboxId
  )
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

sandboxTest.skipIf(isDebug)('list paused sandboxes', async ({ sandbox }) => {
  const pausedSandbox = await sandbox.pause()
  const pausedSandboxId = pausedSandbox.split('-')[0] + '-' + '00000000'
  const { sandboxes } = await Sandbox.list({ state: ['paused'] })

  assert.isAtLeast(sandboxes.length, 1)
  assert.include(
    sandboxes.map((s) => s.sandboxId),
    pausedSandboxId
  )
})

sandboxTest.skipIf(isDebug)('list running sandboxes', async ({ sandbox }) => {
  const extraSbx = await Sandbox.create()
  const { sandboxes } = await Sandbox.list({ state: ['running'] })

  assert.isAtLeast(sandboxes.length, 1)
  assert.include(
    sandboxes.map((s) => s.sandboxId),
    extraSbx.sandboxId
  )
})

sandboxTest.skipIf(isDebug)(
  'list sandboxes with limit',
  async ({ sandbox }) => {
    const { sandboxes } = await Sandbox.list({ limit: 1 })
    assert.equal(sandboxes.length, 1)
    assert.include(
      sandboxes.map((s) => s.sandboxId),
      sandbox.sandboxId
    )
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate running sandboxes',
  async ({ sandbox }) => {
    const extraSbx = await Sandbox.create()

    try {
      const { sandboxes, hasMoreItems, nextToken } = await Sandbox.list({
        state: ['running'],
        limit: 1,
      })

      // check first page
      assert.equal(sandboxes.length, 1)
      assert.equal(sandboxes[0].state, 'running')
      assert.isTrue(hasMoreItems)
      assert.notEqual(nextToken, undefined)

      // new sandbox should be on first page
      assert.include(
        sandboxes.map((s) => s.sandboxId),
        extraSbx.sandboxId
      )

      // fetch second page
      const {
        sandboxes: sandboxes2,
        hasMoreItems: hasMoreItems2,
        nextToken: nextToken2,
      } = await Sandbox.list({
        state: ['running'],
        nextToken: nextToken,
        limit: 1,
      })

      // check second page
      assert.equal(sandboxes2.length, 1)
      assert.equal(sandboxes2[0].state, 'running')
      assert.isFalse(hasMoreItems2)
      assert.equal(nextToken2, undefined)

      // past sandbox should be on second page
      assert.include(
        sandboxes2.map((s) => s.sandboxId),
        sandbox.sandboxId
      )
    } finally {
      await extraSbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate paused sandboxes',
  async ({ sandbox }) => {
    // pause the current sandbox
    await sandbox.pause()

    // create a new sandbox
    const extraSbx = await Sandbox.create()
    await extraSbx.pause()

    const { sandboxes, hasMoreItems, nextToken } = await Sandbox.list({
      state: ['paused'],
      limit: 1,
    })

    // check first page
    assert.equal(sandboxes.length, 1)
    assert.equal(sandboxes[0].state, 'paused')
    assert.isTrue(hasMoreItems)
    assert.notEqual(nextToken, undefined)

    // new sandbox should be on first page
    assert.include(
      sandboxes.map((s) => s.sandboxId),
      extraSbx.sandboxId
    )

    // fetch second page
    const {
      sandboxes: sandboxes2,
      hasMoreItems: hasMoreItems2,
      nextToken: nextToken2,
    } = await Sandbox.list({
      state: ['paused'],
      nextToken: nextToken,
      limit: 1,
    })

    // check second page
    assert.equal(sandboxes2.length, 1)
    assert.equal(sandboxes2[0].state, 'paused')
    assert.isFalse(hasMoreItems2)
    assert.equal(nextToken2, undefined)

    // past sandbox should be on second page
    assert.include(
      sandboxes2.map((s) => s.sandboxId),
      sandbox.sandboxId
    )
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate paused and running sandboxes',
  async ({ sandbox }) => {
    // create a new sandbox
    const extraSbx = await Sandbox.create()
    await extraSbx.pause()

    const { sandboxes, hasMoreItems, nextToken } = await Sandbox.list({
      state: ['paused', 'running'],
      limit: 1,
    })

    // check first page
    assert.equal(sandboxes.length, 1)
    assert.equal(sandboxes[0].state, 'paused')
    assert.isTrue(hasMoreItems)
    assert.notEqual(nextToken, undefined)

    // new sandbox should be on first page
    assert.include(
      sandboxes.map((s) => s.sandboxId),
      extraSbx.sandboxId
    )

    // fetch second page
    const {
      sandboxes: sandboxes2,
      hasMoreItems: hasMoreItems2,
      nextToken: nextToken2,
    } = await Sandbox.list({
      state: ['paused'],
      nextToken: nextToken,
      limit: 1,
    })

    // check second page
    assert.equal(sandboxes2.length, 1)
    assert.equal(sandboxes2[0].state, 'running')
    assert.isFalse(hasMoreItems2)
    assert.equal(nextToken2, undefined)

    // past sandbox should be on second page
    assert.include(
      sandboxes2.map((s) => s.sandboxId),
      sandbox.sandboxId
    )
  }
)
