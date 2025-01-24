import { assert } from 'vitest'

import Sandbox from '../../src/index.js'
import { sandboxTest, wait } from '../setup.js'

sandboxTest('get sandbox metrics', async ({ sandbox }) => {
  console.log('Getting metrics for sandbox ID:', sandbox.sandboxId)

  await wait(2_000)

  const metrics = await sandbox.getMetrics()

  assert.isAtLeast(metrics.length, 1)
  assert.isAtLeast(metrics[0]?.cpuUsedPct, 0)
  assert.isAtLeast(metrics[0]?.memTotalMiB, 0)
  assert.isAtLeast(metrics[0]?.memUsedMiB, 0)

  const metrics2 = await Sandbox.getMetrics(sandbox.sandboxId)
  assert.isAtLeast(metrics2.length, 1)
  assert.isAtLeast(metrics2[0]?.cpuUsedPct, 0)
  assert.isAtLeast(metrics2[0]?.memTotalMiB, 0)
  assert.isAtLeast(metrics2[0]?.memUsedMiB, 0)
})
