import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { Template, waitForTimeout } from '../../src'

test('build template in background', async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .skipCache()
    .runCmd('sleep 5') // Add a delay to ensure build takes time
    .setStartCmd('echo "Hello"', waitForTimeout(10_000))

  const alias = `e2b-test-${randomUUID()}`

  const buildInfo = await Template.buildInBackground(template, {
    alias,
    cpuCount: 1,
    memoryMB: 1024,
  })

  // Should return quickly (within a few seconds), not wait for the full build
  expect(buildInfo).toBeDefined()

  // Verify the build is actually running
  const status = await Template.getBuildStatus(buildInfo)
  expect(status.status).toEqual('building')
}, 10_000)
