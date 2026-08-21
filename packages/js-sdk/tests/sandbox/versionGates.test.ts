import { afterAll, assert, beforeAll, describe, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { ConnectionConfig, Sandbox } from '../../src'
import { SandboxError, TemplateError } from '../../src/errors'
import {
  ENVD_COMMANDS_STDIN,
  ENVD_DEBUG_FALLBACK,
  ENVD_VERSION_FS_EVENT_ENTRY_INFO,
  ENVD_VERSION_RECURSIVE_WATCH,
  ENVD_VERSION_WATCH_NETWORK_MOUNTS,
} from '../../src/envd/versions'
import { belowEnvdVersion, TEST_API_KEY } from '../setup'

const sandboxId = 'sbx-version-gate'
const envdUrl = `https://49983-${sandboxId}.sandbox.e2b.dev`

// A gate that passes lets the call through to envd, so the RPC is mocked
// instead of reaching the network.
const server = setupServer(
  http.post(`${envdUrl}/*`, () =>
    HttpResponse.json({ code: 14, message: 'unavailable' }, { status: 503 })
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

/**
 * The version gates reject unsupported options before any request leaves the
 * SDK, so a sandbox handle over the mocked envd is enough.
 */
function sandboxWithEnvd(envdVersion: string): Sandbox {
  const config = new ConnectionConfig({ apiKey: TEST_API_KEY })
  return new Sandbox({
    ...config,
    sandboxId,
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion,
    envdAccessToken: 'token',
  })
}

describe('commands', () => {
  test('rejects stdin:false below ENVD_COMMANDS_STDIN', async () => {
    const sandbox = sandboxWithEnvd(belowEnvdVersion(ENVD_COMMANDS_STDIN))

    await expect(
      sandbox.commands.run('echo hello', { stdin: false })
    ).rejects.toThrowError(SandboxError)
  })

  test('reports the envd version in the error message', async () => {
    const envdVersion = belowEnvdVersion(ENVD_COMMANDS_STDIN)
    const sandbox = sandboxWithEnvd(envdVersion)

    await sandbox.commands.run('echo hello', { stdin: false }).then(
      () => assert.fail('expected the version gate to reject'),
      (err: Error) => assert.include(err.message, envdVersion)
    )
  })
})

describe('watchDir', () => {
  const noop = () => {}

  // TODO: the gates should reject with InvalidArgumentError — this is
  // argument validation on `sandbox.files`, not a template build.
  test('rejects recursive below ENVD_VERSION_RECURSIVE_WATCH', async () => {
    const sandbox = sandboxWithEnvd(
      belowEnvdVersion(ENVD_VERSION_RECURSIVE_WATCH)
    )

    await expect(
      sandbox.files.watchDir('/home/user', noop, { recursive: true })
    ).rejects.toThrowError(TemplateError)
  })

  test('rejects includeEntry below ENVD_VERSION_FS_EVENT_ENTRY_INFO', async () => {
    const sandbox = sandboxWithEnvd(
      belowEnvdVersion(ENVD_VERSION_FS_EVENT_ENTRY_INFO)
    )

    await expect(
      sandbox.files.watchDir('/home/user', noop, { includeEntry: true })
    ).rejects.toThrowError(TemplateError)
  })

  test('rejects allowNetworkMounts below ENVD_VERSION_WATCH_NETWORK_MOUNTS', async () => {
    const sandbox = sandboxWithEnvd(
      belowEnvdVersion(ENVD_VERSION_WATCH_NETWORK_MOUNTS)
    )

    await expect(
      sandbox.files.watchDir('/home/user', noop, { allowNetworkMounts: true })
    ).rejects.toThrowError(TemplateError)
  })

  test('accepts the gated options on a supported envd', async () => {
    // The gates pass, so the call proceeds to the mocked RPC and fails there
    // instead — the point is that it is not a TemplateError.
    const sandbox = sandboxWithEnvd(ENVD_DEBUG_FALLBACK)

    await sandbox.files
      .watchDir('/home/user', noop, {
        recursive: true,
        includeEntry: true,
        allowNetworkMounts: true,
        requestTimeoutMs: 1_000,
      })
      .then(
        () => assert.fail('expected the mocked RPC to fail'),
        (err: Error) => assert.notInstanceOf(err, TemplateError)
      )
  })
})
