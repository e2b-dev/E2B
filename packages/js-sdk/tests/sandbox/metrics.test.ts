import { assert } from 'vitest'

import { sandboxTest, wait } from '../setup.js'

sandboxTest('get sandbox metrics', async ({ sandbox }) => {
  let testPassed = false

  const attempts = 10
  const intervalDuration = 10_000

  for (let i = 0; i < attempts; i++) {
    const metrics = await sandbox.getMetrics()
    if (metrics && metrics.length >= 1) {
      assert.isAtLeast(metrics.length, 1)
      assert.isAtLeast(metrics[0]?.cpuUsedPct, 0)
      assert.isAtLeast(metrics[0]?.memTotalMiB, 0)
      assert.isAtLeast(metrics[0]?.memUsedMiB, 0)
      testPassed = true
      break
    } else {
      await wait(intervalDuration)
      continue
    }
  }
  assert.isTrue(
    testPassed,
    `Metrics were not returned after ${(attempts * intervalDuration) / 1000}s`
  )
})
