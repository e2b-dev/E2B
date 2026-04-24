import { expect } from 'vitest'

import { SandboxMetrics } from '../../src'
import { sandboxTest, isDebug, wait } from '../setup.js'

sandboxTest.skipIf(isDebug)(
  'sbx metrics',
  { timeout: 60_000 },
  async ({ sandbox }) => {
    const now = new Date()
    let metrics: SandboxMetrics[]
    for (let i = 0; i < 60; i++) {
      metrics = await sandbox.getMetrics()
      if (metrics.length > 0) {
        break
      }
      await wait(500)
    }

    expect(metrics.length).toBeGreaterThan(0)
    const metric = metrics[0]
    expect(metric.diskTotal).toBeDefined()
    expect(metric.diskUsed).toBeDefined()
    expect(metric.memTotal).toBeDefined()
    expect(metric.memUsed).toBeDefined()
    expect(metric.cpuUsedPct).toBeDefined()
    expect(metric.cpuCount).toBeDefined()

    metrics = await sandbox.getMetrics({ start: now, end: new Date() })
    expect(metrics.length).toBeGreaterThan(0)
  }
)
