import { assert } from 'vitest'

import { isDebug, sandboxTest, wait } from '../setup.mjs'

sandboxTest('ping server in sandbox', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('python -m http.server 8000', { background: true })

  try {
    await wait(1000)

    const host = sandbox.getHost(8000)

    const res = await fetch(`${isDebug ? 'http' : 'https'}://${host}`)

    assert.equal(res.status, 200)
  } finally {
    try {
      await cmd.kill()
    } catch (e) {
      console.error(e)
    }
  }
})
