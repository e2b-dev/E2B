import { assert } from 'vitest'
import { randomUUID } from 'crypto'

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
  const uniqueId = randomUUID()
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
  'list by state',
  async ({ sandboxTestId }) => {
    const runningSbx = await Sandbox.create({ metadata: { sandboxTestId } })
    const pausedSbx = await Sandbox.create({ metadata: { sandboxTestId } })
    await pausedSbx.betaPause()

    try {
      const runningPaginator = Sandbox.list({
        query: { metadata: { sandboxTestId }, state: ['running'] },
      })
      const runningSandboxes = await runningPaginator.nextItems()

      assert.isAtLeast(runningSandboxes.length, 1)
      assert.isTrue(
        runningSandboxes.some(
          (s) => s.sandboxId === runningSbx.sandboxId && s.state === 'running'
        )
      )

      const pausedPaginator = Sandbox.list({
        query: { metadata: { sandboxTestId }, state: ['paused'] },
      })
      const pausedSandboxes = await pausedPaginator.nextItems()

      assert.isAtLeast(pausedSandboxes.length, 1)
      assert.isTrue(
        pausedSandboxes.some(
          (s) => s.sandboxId === pausedSbx.sandboxId && s.state === 'paused'
        )
      )
    } finally {
      await runningSbx.kill()
      await pausedSbx.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'paginate sandboxes',
  async ({ sandbox, sandboxTestId }) => {
    const extraSbx = await Sandbox.create({ metadata: { sandboxTestId } })

    try {
      const paginator = Sandbox.list({
        limit: 1,
        query: { metadata: { sandboxTestId }, state: ['running'] },
      })
      const page1 = await paginator.nextItems()

      assert.equal(page1.length, 1)
      assert.equal(page1[0].state, 'running')
      assert.isTrue(paginator.hasNext)
      assert.notEqual(paginator.nextToken, undefined)
      assert.equal(page1[0].sandboxId, extraSbx.sandboxId)

      const page2 = await paginator.nextItems()

      assert.equal(page2.length, 1)
      assert.equal(page2[0].state, 'running')
      assert.isFalse(paginator.hasNext)
      assert.equal(paginator.nextToken, undefined)
      assert.equal(page2[0].sandboxId, sandbox.sandboxId)
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
