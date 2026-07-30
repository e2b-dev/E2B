import { assert, expect, test } from 'vitest'

import { InvalidArgumentError, Sandbox } from '../../src'
import { isDebug, template, wait } from '../setup.js'

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
      await wait(5_000)

      assert.equal((await sandbox.getInfo()).state, 'paused')
      assert.isFalse(await sandbox.isRunning())

      await sandbox.connect()

      assert.equal((await sandbox.getInfo()).state, 'running')
      assert.isTrue(await sandbox.isRunning())
    } finally {
      await sandbox.kill().catch(() => {})
    }
  },
  60_000
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

      await wait(5_000)

      assert.equal((await sandbox.getInfo()).state, 'paused')

      // A filesystem-only snapshot cannot auto-resume on traffic; connect
      // resumes it by cold-booting.
      await sandbox.connect()

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
  60_000
)

test.skipIf(isDebug)(
  'auto-resume wakes paused sandbox on http request',
  async () => {
    const sandbox = await Sandbox.create(template, {
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

      await wait(5_000)

      const url = `https://${sandbox.getHost(8000)}`
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })

      assert.equal(res.status, 200)
      assert.equal((await sandbox.getInfo()).state, 'running')
      assert.isTrue(await sandbox.isRunning())
    } finally {
      await sandbox.kill().catch(() => {})
    }
  },
  60_000
)
