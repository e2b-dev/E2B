import { assert, expect, test } from 'vitest'

import { Sandbox } from '../../src'
import { template, isDebug } from '../setup.js'

test.skipIf(isDebug)('create', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 5_000 })
  try {
    const isRunning = await sbx.isRunning()
    // @ts-ignore It's only for testing
    assert.isDefined(sbx.envdApi.version)
    assert.isTrue(isRunning)
  } finally {
    await sbx.kill()
  }
})

test.skipIf(isDebug)('metadata', async () => {
  const metadata = {
    'test-key': 'test-value',
  }

  const sbx = await Sandbox.create(template, { timeoutMs: 5_000, metadata })

  try {
    const paginator = Sandbox.list()
    const sbxs = await paginator.nextItems()
    const sbxInfo = sbxs.find((s) => s.sandboxId === sbx.sandboxId)

    assert.deepEqual(sbxInfo?.metadata, metadata)
  } finally {
    await sbx.kill()
  }
})

test.skipIf(isDebug)(
  'MCP gateway start failure kills the created sandbox',
  async () => {
    const metadata = { mcpGatewayCleanupTestId: crypto.randomUUID() }
    const query = { state: ['running' as const], metadata }
    let remainingSandboxes: Awaited<
      ReturnType<ReturnType<typeof Sandbox.list>['nextItems']>
    > = []

    try {
      await expect(
        Sandbox.create({
          timeoutMs: 60_000,
          metadata,
          mcp: { invalid_server: {} } as never,
        })
      ).rejects.toThrow('Failed to start MCP gateway')

      remainingSandboxes = await Sandbox.list({ query }).nextItems()
      expect(remainingSandboxes).toEqual([])
    } finally {
      remainingSandboxes = await Sandbox.list({ query })
        .nextItems()
        .catch(() => remainingSandboxes)
      await Promise.all(
        remainingSandboxes.map((sandbox) =>
          Sandbox.kill(sandbox.sandboxId).catch(() => false)
        )
      )
    }
  }
)
