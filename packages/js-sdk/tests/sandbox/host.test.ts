import { assert } from 'vitest'

import { isDebug, sandboxTest, wait } from '../setup.js'

sandboxTest('ping server in sandbox', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('python -m http.server 8000', { 
    background: true,
    onStdout: (data) => {
      console.log('stdout', data)
    },
    onStderr: (data) => {
      console.log('stderr', data)
    },
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
}, 60_000 )
