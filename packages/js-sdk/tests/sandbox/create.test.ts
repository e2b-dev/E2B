import { assert, expect } from 'vitest'

import { Sandbox } from '../../src'
import { hostedTest, template } from '../setup.js'

hostedTest('create', async () => {
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

hostedTest('metadata', async () => {
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

hostedTest('MCP gateway start failure kills the created sandbox', async () => {
  const metadata = { mcpGatewayCleanupTestId: crypto.randomUUID() }
  const query = { state: ['running' as const], metadata }
  let remainingSandboxes: Awaited<
    ReturnType<ReturnType<typeof Sandbox.list>['nextItems']>
  > = []

  try {
    // The base template has no mcp-gateway binary, so gateway startup
    // reliably fails after the sandbox has been allocated.
    await expect(
      Sandbox.create(template, {
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
})
