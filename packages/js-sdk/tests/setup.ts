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
import { runtime } from '../src/utils'
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

export const isDebug = process.env.E2B_DEBUG !== undefined

/** Placeholder API key with a valid format for tests that don't hit the API. */
export const TEST_API_KEY = `e2b_${'0'.repeat(40)}`

/**
 * Whether the test can read a response from a server running inside a sandbox.
 *
 * A browser only exposes a cross-origin response to JS when the server opts in
 * with CORS headers. Servers a test starts in a sandbox (`python -m
 * http.server`, and the sandbox proxy's own 502 page) don't, so there the fetch
 * fails as an opaque `TypeError: Failed to fetch` no matter what the server
 * answered. Nothing the SDK can paper over — a real browser app would hit the
 * same wall.
 */
export const canFetchSandboxServers = runtime !== 'browser'

/**
 * Whether the test can read the pagination cursor the API returns.
 *
 * `Paginator` takes its cursor from the `x-next-token` response header, and the
 * API doesn't name that header in `Access-Control-Expose-Headers` — so a
 * browser withholds it from JS and every page looks like the last one.
 * Paginating with a `limit` can't work there until the API exposes the header;
 * the SDK can't reach around CORS.
 */
export const canReadPaginationToken = runtime !== 'browser'

/**
 * Whether the test can observe a sandbox that has stopped.
 *
 * `isRunning()` reads envd's `/health` over the sandbox host, and a stopped
 * sandbox answers 502 from the edge without CORS headers — so in a browser the
 * probe rejects instead of reporting `false`. That also costs the health-check
 * refinement in `handleRpcErrorWithHealthCheck`: a connection dropped by a kill
 * stays a generic `SandboxError` there instead of a `TimeoutError`.
 */
export const canObserveStoppedSandbox = runtime !== 'browser'

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
