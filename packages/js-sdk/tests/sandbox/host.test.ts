import { assert } from 'vitest'

import { isDebug, sandboxTest, wait } from '../setup.js'

sandboxTest.skipIf(isDebug)(
  'ping server in running sandbox',
  async ({ sandbox }) => {
    const cmd = await sandbox.commands.run('python -m http.server 8000', {
      background: true,
    })

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
    const cmd = await sandbox.commands.run('python -m http.server 8000', {
      background: true,
    })

    await wait(1000)

    const host = sandbox.getHost(8000)
    const url = `${isDebug ? 'http' : 'https'}://${host}`
    const res = await fetch(url)

    assert.equal(res.status, 200)

    await sandbox.kill()

    const res2 = await fetch(url)
    assert.equal(res2.status, 502)

    const text = await res2.text()
    const json = JSON.parse(text) as {
      message: string
      sandboxId: string
      code: number
    }
    assert.equal(json.message, 'Sandbox not found')
    assert.isTrue(sandbox.sandboxId.startsWith(json.sandboxId))
    assert.equal(json.code, 0)
  }
)
