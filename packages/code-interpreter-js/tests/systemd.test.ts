import { expect } from 'vitest'
import { isDebug, sandboxTest, wait } from './setup'

async function waitForHealth(sandbox: any, maxRetries = 10, intervalMs = 100) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await sandbox.commands.run(
        'curl -s -o /dev/null -w "%{http_code}" http://0.0.0.0:49999/health'
      )
      if (result.stdout.trim() === '200') {
        return true
      }
    } catch {
      // Connection refused or other error, retry
    }
    await wait(intervalMs)
  }
  return false
}

sandboxTest.skipIf(isDebug)(
  'restart after jupyter kill',
  async ({ sandbox }) => {
    // Verify health is up initially
    const initialHealth = await waitForHealth(sandbox)
    expect(initialHealth).toBe(true)

    // Kill the jupyter process as root
    // The command handle may get killed too (since killing jupyter cascades to code-interpreter),
    // so we catch the error.
    try {
      await sandbox.commands.run("kill -9 $(pgrep -f 'jupyter server')", {
        user: 'root',
      })
    } catch {
      // Expected — the kill cascade may terminate the command handle
    }

    // Wait for systemd to restart both services
    const recovered = await waitForHealth(sandbox, 60, 500)
    expect(recovered).toBe(true)

    // Verify code execution works after recovery
    const result = await sandbox.runCode('x = 1; x')
    expect(result.text).toEqual('1')
  }
)

sandboxTest.skipIf(isDebug)(
  'restart after code-interpreter kill',
  async ({ sandbox }) => {
    // Verify health is up initially
    const initialHealth = await waitForHealth(sandbox)
    expect(initialHealth).toBe(true)

    // Kill the code-interpreter process as root
    try {
      await sandbox.commands.run("kill -9 $(pgrep -f 'uvicorn main:app')", {
        user: 'root',
      })
    } catch {
      // Expected — killing code-interpreter may terminate the command handle
    }

    // Wait for systemd to restart it and health to come back
    const recovered = await waitForHealth(sandbox, 60, 500)
    expect(recovered).toBe(true)

    // Verify code execution works after recovery
    const result = await sandbox.runCode('x = 1; x')
    expect(result.text).toEqual('1')
  }
)
