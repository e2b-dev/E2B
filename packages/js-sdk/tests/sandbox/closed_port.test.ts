import { test, assert } from 'vitest'

import { Sandbox } from '../../src/index.js'
import { isDebug, template, wait } from '../setup.js'

test.skipIf(isDebug)('closed port', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 60_000 })
  const goodPort = 8000

  await sbx.commands.run(`python -m http.server ${goodPort}`, {
    background: true,
  })

  await wait(1000)

  const goodHost = sbx.getHost(goodPort)
  // leave this here as a helper to visit host in browser
  console.log('goodHost', 'https://' + goodHost)

  let res = await fetch(`${isDebug ? 'http' : 'https'}://${goodHost}`)

  for (let i = 0; i < 10; i++) {
    if (res.status === 200) {
      break
    }

    res = await fetch(`${isDebug ? 'http' : 'https'}://${goodHost}`)
    await wait(500)
  }
  assert.equal(res.status, 200)

  const badPort = 3000
  const badHost = sbx.getHost(badPort)
  // leave this here as a helper to visit host in browser
  console.log('badHost', 'https://' + badHost)

  res = await fetch(`${isDebug ? 'http' : 'https'}://${badHost}`)
  assert.equal(res.status, 502)
  const resp_text = await res.text()
  const resp = JSON.parse(resp_text)
  const [cleanedSbxId] = sbx.sandboxId.split('-')

  assert.equal(resp.error, 'The sandbox is running but port is not open')
  assert.equal(cleanedSbxId, resp.sandboxId)
  assert.equal(resp.port, `:${badPort}`)
})
