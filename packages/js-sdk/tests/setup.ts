import { Sandbox } from '../src'
import { test as base } from 'vitest'

export const template = 'base'

interface SandboxFixture {
  sandbox: Sandbox
  template: string
  sandboxType: string
}

export const sandboxTest = base.extend<SandboxFixture>({
  template,
  sandboxType: [
    async ({}, use) => {
      const id = `test-${generateRandomString()}`
      await use(id)
    },
    { auto: true },
  ],
  sandbox: [
    async ({ sandboxType }, use) => {
      const sandbox = await Sandbox.create(template, {
        metadata: { sandboxType },
      })
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
    { auto: true },
  ],
})

export const isDebug = process.env.E2B_DEBUG !== undefined
export const isIntegrationTest = process.env.E2B_INTEGRATION_TEST !== undefined

function generateRandomString(length: number = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, length + 2)
}

export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
