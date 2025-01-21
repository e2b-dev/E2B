import { assert } from 'vitest'

import { sandboxTest } from '../setup.js'

sandboxTest('get sandbox metrics', async ({ sandbox }) => {
  const metrics = await sandbox.getMetrics()

  assert.isAtLeast(metrics.length, 1)
  assert.isAtLeast(metrics[0]?.cpuPct, 0)
  assert.isAtLeast(metrics[0]?.memMiBTotal, 0)
  assert.isAtLeast(metrics[0]?.memMiBUsed, 0)
})
