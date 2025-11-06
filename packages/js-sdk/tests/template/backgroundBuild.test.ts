import { expect, test } from 'vitest'
import { Template, waitForTimeout } from '../../src'
import { randomUUID } from 'node:crypto'

test('build template in background', async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .runCmd('sleep 5') // Add a delay to ensure build takes time
    .setStartCmd('echo "Hello"', waitForTimeout(10_000))

  const alias = `e2b-test-${randomUUID()}`
  const startTime = Date.now()

  const buildInfo = await Template.buildInBackground(template, {
    alias,
    cpuCount: 1,
    memoryMB: 1024,
  })

  const elapsedTime = Date.now() - startTime

  // Should return quickly (within a few seconds), not wait for the full build
  expect(buildInfo).toBeDefined()
  expect(elapsedTime).toBeLessThan(10_000) // Should be much faster than the full build

  // Verify the build is actually running
  const status = await Template.getBuildStatus(buildInfo)
  expect(['building', 'waiting', 'ready']).toContain(status.status)
}, 30_000)
