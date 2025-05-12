import { assert } from 'vitest'

import { isDebug, sandboxTest, wait } from '../setup.js'
import { catchCmdExitErrorInBackground } from '../cmdHelper.js'
sandboxTest(
  'ping server in running sandbox',
  async ({ sandbox }) => {
    const cmd = await sandbox.commands.run('python -m http.server 8000', {
      background: true,
    })

    const disable = catchCmdExitErrorInBackground(cmd)

    try {
      await wait(1000)

      const host = sandbox.getHost(8000)

      let res = await fetch(`${isDebug ? 'http' : 'https'}://${host}`)

      for (let i = 0; i < 20; i++) {
        if (res.status === 200) {
          break
        }

        res = await fetch(`${isDebug ? 'http' : 'https'}://${host}`)
        await wait(500)
      }
      assert.equal(res.status, 200)
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
