import { Sandbox } from '../src'
import { test as base } from 'vitest'

const timeoutMs = 60_000
const template = 'desktop'

interface SandboxFixture {
  sandbox: Sandbox
}

export const sandboxTest = base.extend<SandboxFixture>({
  sandbox: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const sandbox = await Sandbox.create(template, { timeoutMs })
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

export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
