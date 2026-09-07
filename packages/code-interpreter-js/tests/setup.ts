import { test as base } from 'vitest'
import { Sandbox, SandboxError, SandboxOpts } from '../src'

interface SandboxFixture {
  sandbox: Sandbox
  template: string
  sandboxTestId: string
  sandboxOpts: Partial<SandboxOpts>
}

const template = process.env.E2B_TESTS_TEMPLATE || 'code-interpreter-v1'
const KERNEL_READINESS_ATTEMPTS = 4

export const sandboxTest = base.extend<SandboxFixture>({
  template,
  sandboxTestId: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const id = `test-${generateRandomString()}`
      await use(id)
    },
    { auto: true },
  ],
  sandboxOpts: {},
  sandbox: [
    async ({ sandboxTestId, sandboxOpts }, use) => {
      const sandbox = await Sandbox.create(template, {
        metadata: { sandboxTestId },
        ...sandboxOpts,
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
    { auto: false },
  ],
})

export const isDebug = process.env.E2B_DEBUG !== undefined
export const isIntegrationTest = process.env.E2B_INTEGRATION_TEST !== undefined

export const secureSandboxTest = sandboxTest.extend({
  sandboxOpts: {
    secure: true,
    network: {
      allowPublicTraffic: false,
    },
  },
})

function generateRandomString(length: number = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, length + 2)
}

export async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForKernel(sandbox: Sandbox, language: 'java' | 'r') {
  for (let attempt = 1; attempt <= KERNEL_READINESS_ATTEMPTS; attempt++) {
    try {
      await sandbox.runCode('1', { language })
      return
    } catch (error) {
      // A newly running sandbox can briefly return this response while
      // Foxtrot initializes a lazy language context. Retry only that known
      // readiness failure; the test's actual execution still runs once.
      const isReadinessError =
        error instanceof SandboxError &&
        /^500 Internal Server Error(?: \(trace_id=[^)]+\))?$/.test(
          error.message
        )

      if (!isReadinessError || attempt === KERNEL_READINESS_ATTEMPTS) {
        throw error
      }
    }
  }
}

export { template }
