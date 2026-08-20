import { afterAll, beforeAll, expect } from 'vitest'
import { setupServer } from 'msw/node'
import { Template } from '../../../src'
import { buildTemplateTest } from '../../setup'
import { createMockBuildApi } from '../mockBuildApi'

const server = setupServer(...createMockBuildApi().handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

buildTemplateTest('run command', async ({ buildTemplate }) => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .skipCache()
    .runCmd('ls -l')

  await buildTemplate(template)
})

buildTemplateTest(
  'run command as a different user',
  async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:22.04')
      .skipCache()
      .runCmd('test "$(whoami)" = "root"', { user: 'root' })

    await buildTemplate(template)
  }
)

buildTemplateTest(
  'run command as user that does not exist',
  async ({ buildTemplate }) => {
    const template = Template()
      .fromImage('ubuntu:22.04')
      .skipCache()
      .runCmd('whoami', { user: 'root123' })

    await expect(buildTemplate(template)).rejects.toThrow(
      "failed to run command 'whoami': command failed: unauthenticated: invalid username: 'root123'"
    )
  }
)
