import { assert, describe, expect, test } from 'vitest'

import { ConnectionConfig, Sandbox } from '../../src'
import { SandboxError, TemplateError } from '../../src/errors'
import { TEST_API_KEY } from '../setup'

/**
 * The version gates reject unsupported options before any request leaves the
 * SDK, so a sandbox handle pointed at a nonexistent domain is enough.
 */
function sandboxWithEnvd(envdVersion: string): Sandbox {
  const config = new ConnectionConfig({ apiKey: TEST_API_KEY })
  return new Sandbox({
    ...config,
    sandboxId: 'sbx-version-gate',
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion,
    envdAccessToken: 'token',
  })
}

describe('commands', () => {
  test('rejects stdin:false below ENVD_COMMANDS_STDIN', async () => {
    const sandbox = sandboxWithEnvd('0.2.4')

    await expect(
      sandbox.commands.run('echo hello', { stdin: false })
    ).rejects.toThrowError(SandboxError)
  })

  test('reports the envd version in the error message', async () => {
    const sandbox = sandboxWithEnvd('0.2.4')

    await sandbox.commands.run('echo hello', { stdin: false }).then(
      () => assert.fail('expected the version gate to reject'),
      (err: Error) => assert.include(err.message, '0.2.4')
    )
  })
})

describe('watchDir', () => {
  const noop = () => {}

  test('rejects recursive below ENVD_VERSION_RECURSIVE_WATCH', async () => {
    const sandbox = sandboxWithEnvd('0.1.3')

    await expect(
      sandbox.files.watchDir('/home/user', noop, { recursive: true })
    ).rejects.toThrowError(TemplateError)
  })

  test('rejects includeEntry below ENVD_VERSION_FS_EVENT_ENTRY_INFO', async () => {
    const sandbox = sandboxWithEnvd('0.6.2')

    await expect(
      sandbox.files.watchDir('/home/user', noop, { includeEntry: true })
    ).rejects.toThrowError(TemplateError)
  })

  test('rejects allowNetworkMounts below ENVD_VERSION_WATCH_NETWORK_MOUNTS', async () => {
    const sandbox = sandboxWithEnvd('0.6.3')

    await expect(
      sandbox.files.watchDir('/home/user', noop, { allowNetworkMounts: true })
    ).rejects.toThrowError(TemplateError)
  })

  test('accepts the gated options on a supported envd', async () => {
    // The gates pass, so the call proceeds to the RPC and fails on the network
    // instead — the point is that it is not a TemplateError.
    const sandbox = sandboxWithEnvd('0.6.4')

    await sandbox.files
      .watchDir('/home/user', noop, {
        recursive: true,
        includeEntry: true,
        allowNetworkMounts: true,
        requestTimeoutMs: 1_000,
      })
      .then(
        () => assert.fail('expected the request to fail without a sandbox'),
        (err: Error) => assert.notInstanceOf(err, TemplateError)
      )
  })
})
