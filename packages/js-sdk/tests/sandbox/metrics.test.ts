import { expect } from 'vitest'

import { SandboxMetrics } from '../../src'
import { sandboxTest, isDebug, wait } from '../setup.js'

sandboxTest.skipIf(isDebug)(
  'sbx metrics',
  { timeout: 60_000 },
  async ({ sandbox }) => {
    // Wait for the sandbox to have some metrics
    let metrics: SandboxMetrics[] = []
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
  }
)

sandboxTest.skipIf(isDebug)(
  'sbx metrics time range',
  { timeout: 60_000 },
  async ({ sandbox }) => {
    const start = new Date()

    // Wait for the sandbox to have some metrics within the test's time window
    let metrics: SandboxMetrics[] = []
    let end = new Date()
    for (let i = 0; i < 60; i++) {
      end = new Date()
      metrics = await sandbox.getMetrics({ start, end })
      if (metrics.length > 0) {
        break
      }
      await wait(500)
    }

    expect(metrics.length).toBeGreaterThan(0)

    // All returned metrics must fall within the requested time range
    // (10s slack — metric timestamps are aligned to collection buckets,
    // currently 5s, and the query params are second-precision)
    const slackMs = 10_000
    for (const m of metrics) {
      expect(m.timestamp.getTime()).toBeGreaterThanOrEqual(
        start.getTime() - slackMs
      )
      expect(m.timestamp.getTime()).toBeLessThanOrEqual(end.getTime() + slackMs)
    }

    // A time range from before the sandbox existed must return no metrics
    const noMetrics = await sandbox.getMetrics({
      start: new Date(start.getTime() - 60 * 60 * 1000),
      end: new Date(start.getTime() - 30 * 60 * 1000),
    })
    expect(noMetrics).toHaveLength(0)
  }
)
