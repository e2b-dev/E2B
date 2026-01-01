import { randomUUID } from 'node:crypto'
import { test as base } from 'vitest'
import {
  BuildInfo,
  LogEntry,
  Sandbox,
  SandboxOpts,
  Template,
  TemplateClass,
} from '../src'
import { template } from './template'

interface SandboxFixture {
  sandbox: Sandbox
  template: string
  sandboxTestId: string
  sandboxOpts: Partial<SandboxOpts>
}

interface BuildTemplateFixture {
  buildTemplate: (
    template: TemplateClass,
    options?: { alias?: string; skipCache?: boolean },
    onBuildLogs?: (logEntry: LogEntry) => void
  ) => Promise<BuildInfo>
}

function buildTemplate(
  template: TemplateClass,
  options?: { alias?: string; skipCache?: boolean },
  onBuildLogs?: (logEntry: LogEntry) => void
) {
  return Template.build(template, {
    alias: options?.alias || `e2b-test-${randomUUID()}`,
    cpuCount: 1,
    memoryMB: 1024,
    skipCache: options?.skipCache,
    onBuildLogs: onBuildLogs,
  })
}

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

export const buildTemplateTest = base.extend<BuildTemplateFixture>({
  buildTemplate: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(buildTemplate)
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

export { template }
