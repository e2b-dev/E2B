import { assert } from 'vitest'

import {
  isDebug,
  sandboxTest,
  waitForHttpStatus,
  corsHttpServerCmd,
} from '../setup.js'
import { catchCmdExitErrorInBackground } from '../cmdHelper.js'
sandboxTest(
  'ping server in running sandbox',
  async ({ sandbox }) => {
    const cmd = await sandbox.commands.run(corsHttpServerCmd(8000), {
      background: true,
    })

    const disable = catchCmdExitErrorInBackground(cmd)

    try {
      const host = sandbox.getHost(8000)
      await waitForHttpStatus(`${isDebug ? 'http' : 'https'}://${host}`, 200)
      disable()
    } finally {
      try {
        await cmd.kill()
      } catch (e) {
        console.error(e)
      }
    }
  },
  60_000
)

sandboxTest.skipIf(isDebug)(
  'ping server in non-running sandbox',
  async ({ sandbox }) => {
    const host = sandbox.getHost(3000)
    const url = `https://${host}`

    await sandbox.kill()

    const res = await fetch(url)
    assert.equal(res.status, 502)

    const text = await res.text()
    const json = JSON.parse(text) as {
      message: string
      sandboxId: string
      code: number
    }
    assert.equal(json.message, 'The sandbox was not found')
    assert.isTrue(sandbox.sandboxId.startsWith(json.sandboxId))
    assert.equal(json.code, 502)
  }
)
