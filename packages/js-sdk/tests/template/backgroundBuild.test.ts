import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { setupServer } from 'msw/node'
import { Template, waitForTimeout } from '../../src'
import { TEST_API_KEY } from '../setup'
import { createMockBuildApi } from './mockBuildApi'

const server = setupServer(...createMockBuildApi().handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

// The placeholder key keeps the mocked template tests independent of
// E2B_API_KEY being set in the environment.
const apiKey = process.env.E2B_API_KEY ?? TEST_API_KEY

test('build template in background', async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .skipCache()
    .runCmd('sleep 5') // Add a delay to ensure build takes time
    .setStartCmd('echo "Hello"', waitForTimeout(10_000))

  const name = `e2b-test:v1-${randomUUID()}`

  const buildInfo = await Template.buildInBackground(template, name, {
    cpuCount: 1,
    memoryMB: 1024,
    apiKey,
  })

  // Should return quickly (within a few seconds), not wait for the full build
  expect(buildInfo).toBeDefined()

  // Verify the build is actually running
  const status = await Template.getBuildStatus(buildInfo, { apiKey })
  expect(status.status).toEqual('building')
}, 10_000)
