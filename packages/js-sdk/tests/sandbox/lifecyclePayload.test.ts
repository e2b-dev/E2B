import { assert, test } from 'vitest'

import { Sandbox } from '../../src'
import { isDebug, template, wait } from '../setup.js'

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
