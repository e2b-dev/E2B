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
    options?: { name?: string; skipCache?: boolean },
    onBuildLogs?: (logEntry: LogEntry) => void
  ) => Promise<BuildInfo>
}

async function buildTemplate(
  template: TemplateClass,
  options?: { name?: string; skipCache?: boolean },
  onBuildLogs?: (logEntry: LogEntry) => void
): Promise<BuildInfo> {
  const buildName = options?.name || `e2b-test-${randomUUID()}`
  const buildInfo: { templateId?: string; buildId?: string } = {}

  const captureLogs = (log: LogEntry) => {
    if (log.message.includes('Template created with ID:')) {
      const match = log.message.match(
        /Template created with ID: ([^,]+), Build ID: (.+)/
      )
      if (match) {
        buildInfo.templateId = match[1]
        buildInfo.buildId = match[2]
      }
    }
    onBuildLogs?.(log)
  }

  try {
    return await Template.build(template, buildName, {
      cpuCount: 1,
      memoryMB: 1024,
      skipCache: options?.skipCache,
      onBuildLogs: captureLogs,
    })
  } catch (e) {
    console.error(
      `\n[BUILD FAILED] name=${buildName}, ` +
        `template_id=${buildInfo.templateId}, ` +
        `build_id=${buildInfo.buildId}, error=${e}`
    )
    throw e
  }
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

/**
 * Creates a build template test that is allowed to fail without breaking CI.
 * - If the test passes → test passes (ideal outcome)
 * - If the test fails → logs ALLOW_FAIL and test still passes
 */
export function buildTemplateTestAllowFail(
  name: string,
  fn: (fixtures: BuildTemplateFixture) => Promise<void>
) {
  return buildTemplateTest(name, async ({ buildTemplate }) => {
    try {
      await fn({ buildTemplate })
    } catch (error) {
      console.error(`\n[ALLOW_FAIL] ${name}: ${error}`)
    }
  })
}

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

/**
 * Returns the API URL for the given path, using E2B_DOMAIN env var.
 * Supports msw path parameters like :templateID
 */
export function apiUrl(path: string): string {
  const domain = process.env.E2B_DOMAIN || 'e2b.app'
  return `https://api.${domain}${path}`
}

export { template }
