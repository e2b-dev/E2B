import { assert } from 'vitest'

import { sandboxTest, wait } from '../setup.js'

sandboxTest('get sandbox metrics', async ({ sandbox }) => {
  console.log('Getting metrics for sandbox ID:', sandbox.sandboxId)

  await wait(5_000)

  const metrics = await sandbox.getMetrics()

  console.log('Metrics:', metrics)
  assert.isAtLeast(metrics.length, 1)
  assert.isAtLeast(metrics[0]?.cpuPct, 0)
  assert.isAtLeast(metrics[0]?.memTotalMiB, 0)
  assert.isAtLeast(metrics[0]?.memUsedMiB, 0)
})
