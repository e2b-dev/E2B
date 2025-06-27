import { SandboxBeta as Sandbox } from '../src'
import { test as base } from 'vitest'
import { template } from './template'

interface SandboxFixture {
  sandbox: Sandbox
}

export const sandboxTest = base.extend<SandboxFixture>({
  sandbox: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const sandbox = await Sandbox.create(template)
      try {
        await use(sandbox)
      } finally {
        try {
          await sandbox.kill()
        } catch (err) {
          if (!isDebug) {
            console.warn(
              'Failed to kill sandbox — this is expected if the test runs with local envd.'
            )
          }
        }
      }
    },
    { auto: false },
  ],
})

export const isDebug = process.env.E2B_DEBUG !== undefined
export const isIntegrationTest = process.env.E2B_INTEGRATION_TEST !== undefined

export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export { template }
