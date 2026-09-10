import { assert, expect, test, vi } from 'vitest'

import { InvalidArgumentError, Sandbox } from '../../src'
import { isDebug, sandboxTest, template, waitForHttpStatus } from '../setup.js'

async function waitForState(
  sandbox: Sandbox,
  state: 'paused' | 'running'
): Promise<void> {
  await vi.waitFor(
    async () => {
      assert.equal(
        (await sandbox.getInfo({ requestTimeoutMs: 5_000 })).state,
        state
      )
    },
    { timeout: 30_000, interval: 500 }
  )
}

function withRequestSource(url: string): string {
  const source = process.env.E2B_USER_AGENT_SOURCE
  return source ? `${url}?source=${encodeURIComponent(source)}` : url
}

test.skipIf(isDebug)(
  'filesystem-only auto-pause cannot be combined with auto-resume',
  async () => {
    // A filesystem-only auto-pause snapshot can only be resumed explicitly, so
    // keepMemory:false with autoResume is rejected client-side.
    await expect(
      Sandbox.create(template, {
        timeoutMs: 3_000,
        lifecycle: {
          onTimeout: { action: 'pause', keepMemory: false },
          autoResume: true,
        },
      })
    ).rejects.toThrowError(InvalidArgumentError)
  }
)

test.skipIf(isDebug)(
  'keepMemory is not allowed when onTimeout action is kill',
  async () => {
    // The discriminated union forbids keepMemory on `action: 'kill'` at compile
    // time (asserted by @ts-expect-error). The runtime guard below additionally
    // rejects it for untyped (JS) callers that bypass the type.
    await expect(
      Sandbox.create(template, {
        timeoutMs: 3_000,
        lifecycle: {
          // @ts-expect-error keepMemory is not allowed with action: 'kill'
          onTimeout: { action: 'kill', keepMemory: false },
        },
      })
    ).rejects.toThrowError(InvalidArgumentError)
  }
)

test.skipIf(isDebug)(
  'auto-pause without auto-resume requires connect to wake',
  async () => {
    const sandbox = await Sandbox.create(template, {
      timeoutMs: 3_000,
      lifecycle: {
        onTimeout: 'pause',
        autoResume: false,
      },
    })

    try {
      await waitForState(sandbox, 'paused')
      assert.isFalse(await sandbox.isRunning())

      await sandbox.connect({ requestTimeoutMs: 120_000 })

      await waitForState(sandbox, 'running')
      assert.isTrue(await sandbox.isRunning())
    } finally {
      await sandbox.kill().catch(() => {})
    }
  },
  210_000
)

test.skipIf(isDebug)(
  'filesystem-only auto-pause reboots on connect',
  async () => {
    // keepMemory:false makes the timeout auto-pause filesystem-only, so resuming
    // cold-boots the sandbox from disk.
    const sandbox = await Sandbox.create(template, {
      timeoutMs: 3_000,
      lifecycle: { onTimeout: { action: 'pause', keepMemory: false } },
    })

    try {
      const marker = 'auto-pause-fs-only'
      await sandbox.files.write('/home/user/auto-pause-marker.txt', marker)
      // Read via a command, not files.read: envd's non-gzip download path
      // serves procfs files as an empty 200 (it sizes them by stat, which is
      // 0), so clients that don't negotiate gzip — like workerd's fetch —
      // silently get '' (infra#3363).
      const bootBefore = (
        await sandbox.commands.run('cat /proc/sys/kernel/random/boot_id')
      ).stdout.trim()

      await waitForState(sandbox, 'paused')

      // A filesystem-only snapshot cannot auto-resume on traffic; connect
      // resumes it by cold-booting.
      await sandbox.connect({ requestTimeoutMs: 120_000 })

      const persisted = (
        await sandbox.files.read('/home/user/auto-pause-marker.txt')
      ).trim()
      assert.equal(persisted, marker)

      const bootAfter = (
        await sandbox.commands.run('cat /proc/sys/kernel/random/boot_id')
      ).stdout.trim()
      assert.notEqual(bootAfter, bootBefore)
    } finally {
      await sandbox.kill().catch(() => {})
    }
  },
  210_000
)

sandboxTest.skipIf(isDebug)(
  'auto-resume wakes paused sandbox on http request',
  async ({ sandboxTestId }) => {
    const sandbox = await Sandbox.create(template, {
      metadata: { sandboxTestId },
      timeoutMs: 3_000,
      lifecycle: {
        onTimeout: 'pause',
        autoResume: true,
      },
    })

    try {
      await sandbox.commands.run('python3 -m http.server 8000', {
        background: true,
      })

      await waitForState(sandbox, 'paused')

      // Each request is a wake signal; keep sending them until the guest
      // server answers, since a request that races the pause finalizing or
      // times out at the gateway while the sandbox resumes may not wake it.
      const url = withRequestSource(`https://${sandbox.getHost(8000)}`)
      await waitForHttpStatus(url, 200, undefined, 60_000)
      await waitForState(sandbox, 'running')
      assert.isTrue(await sandbox.isRunning())
    } catch (error) {
      let state = 'unknown'
      try {
        state = (await sandbox.getInfo({ requestTimeoutMs: 5_000 })).state
      } catch {}
      console.error(
        `\n[AUTO-RESUME FAILED] Sandbox ID: ${sandbox.sandboxId}, state=${state}`
      )
      throw error
    } finally {
      await sandbox.kill().catch(() => {})
    }
  },
  150_000
)
