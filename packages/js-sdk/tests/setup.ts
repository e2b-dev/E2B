import { test as base, onTestFailed } from 'vitest'
import {
  BuildInfo,
  LogEntry,
  Sandbox,
  SandboxOpts,
  Template,
  TemplateClass,
  Volume,
} from '../src'
import { template } from './template'

interface SandboxFixture {
  sandbox: Sandbox
  template: string
  sandboxTestId: string
  sandboxOpts: Partial<SandboxOpts>
}

interface VolumeFixture {
  volume: Volume
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
  const buildName = options?.name || `e2b-test-${generateRandomString()}`
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
    async ({ skip }, use) => {
      // Every sandboxTest provisions a real sandbox, so the whole fixture is
      // opt-in — see the e2e tier in tests/README.md.
      skip(!isE2E, E2E_SKIP_REASON)
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
      onTestFailed(() => {
        console.error(`\n[TEST FAILED] Sandbox ID: ${sandbox.sandboxId}`)
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

export const volumeTest = base.extend<VolumeFixture>({
  volume: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      // The placeholder key keeps the mocked volume tests independent of
      // E2B_API_KEY being set in the environment.
      const volume = await Volume.create(`test-vol-${generateRandomString()}`, {
        apiKey: process.env.E2B_API_KEY ?? TEST_API_KEY,
      })
      onTestFailed(() => {
        console.error(`\n[TEST FAILED] Volume ID: ${volume.volumeId}`)
      })
      try {
        await use(volume)
      } finally {
        try {
          await Volume.destroy(volume.volumeId, {
            apiKey: process.env.E2B_API_KEY ?? TEST_API_KEY,
          })
        } catch {
          // Ignore cleanup errors
        }
      }
    },
    { auto: false },
  ],
})

/** Runs against a local envd instead of a provisioned sandbox. */
export const isDebug = process.env.E2B_DEBUG !== undefined

/** Opt-in for the e2e tier: tests that need real infrastructure. */
export const isE2E = process.env.E2B_E2E !== undefined

const E2E_SKIP_REASON = 'set E2B_E2E=1 to run the e2e tier'

/** A test that needs real infrastructure — skipped unless E2B_E2E is set. */
export const e2eTest = base.skipIf(!isE2E)

/**
 * A test that needs hosted infrastructure — the control plane, the traffic
 * proxy, snapshots — which a local envd can't stand in for, so it stays
 * skipped under E2B_DEBUG on top of the e2e opt-in.
 */
export const hostedTest = e2eTest.skipIf(isDebug)

/** {@link sandboxTest} for a test that needs hosted infrastructure. */
export const hostedSandboxTest = sandboxTest.skipIf(isDebug)

/**
 * A template build against real infrastructure — skipped unless E2B_E2E is
 * set. Builds always run server-side, so E2B_DEBUG skips them too.
 */
export const e2eBuildTemplateTest = buildTemplateTest.skipIf(!isE2E || isDebug)

/** Placeholder API key with a valid format for tests that don't hit the API. */
export const TEST_API_KEY = `e2b_${'0'.repeat(40)}`

/**
 * The highest envd version below one of the `ENVD_*` thresholds, for
 * exercising the reject branch of a version gate without hardcoding a version
 * that stops being below the threshold when it moves. A prerelease of a
 * version sorts below the version itself.
 */
export function belowEnvdVersion(version: string): string {
  return `${version}-0`
}

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
