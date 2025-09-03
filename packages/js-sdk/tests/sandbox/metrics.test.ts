import { expect } from 'vitest'

import { SandboxMetrics } from '../../src'
import { sandboxTest, isDebug, wait } from '../setup.js'

sandboxTest.skipIf(isDebug)('sbx metrics', async ({ sandbox }) => {
  let metrics: SandboxMetrics[]
  for (let i = 0; i < 15; i++) {
    metrics = await sandbox.getMetrics()
    if (metrics.length > 0) {
      break
    }
    await wait(1_000)
  }

  expect(metrics.length).toBeGreaterThan(0)
  const metric = metrics[0]
  expect(metric.diskTotal).toBeDefined()
  expect(metric.diskUsed).toBeDefined()
  expect(metric.memTotal).toBeDefined()
  expect(metric.memUsed).toBeDefined()
  expect(metric.cpuUsedPct).toBeDefined()
  expect(metric.cpuCount).toBeDefined()
})
