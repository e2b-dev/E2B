import { assert } from 'vitest'

import Sandbox from '../../src/index.js'
import { isDebug, sandboxTest, template, wait } from '../setup.js'

sandboxTest.skip('ping server in running sandbox', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('python -m http.server 8000', {
    background: true,
  })

  try {
    await wait(10_000)

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

sandboxTest.skipIf(isDebug)('ping server in non-running sandbox', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 120_000 })

  const cmd = await sbx.commands.run('python -m http.server 8000', {
    background: true,
  })

  try {
    await wait(20_000)

    const host = sbx.getHost(8000)

    const res = await fetch(`${isDebug ? 'http' : 'https'}://${host}`)

    assert.equal(res.status, 200)

    await sbx.kill()

    const res2 = await fetch(`${isDebug ? 'http' : 'https'}://${host}`)
    assert.equal(res2.status, 502)

    const text = await res2.text()
    assert.equal(text, 'Sandbox does not exist.')
  } finally {
    try {
      await cmd.kill()
    } catch (e) {
      console.error(e)
    }
  }
})
