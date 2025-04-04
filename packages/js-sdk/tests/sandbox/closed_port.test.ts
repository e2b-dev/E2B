import { assert, test } from 'vitest'

import { Sandbox } from '../../src/index.js'
import { isDebug, template, wait } from '../setup.js'

test.skipIf(isDebug)('closed port in SDK', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 60_000 })
  const goodPort = 8000

  await sbx.commands.run(`python -m http.server ${goodPort}`, {
    background: true,
  })

  await wait(1000)

  const goodHost = sbx.getHost(goodPort)
  // leave this here as a helper to visit host in browser
  console.log('goodHost', 'https://' + goodHost)

  let res2 = await fetch(`${isDebug ? 'http' : 'https'}://${goodHost}`)

  for (let i = 0; i < 20; i++) {
    if (res2.status === 200) {
      break
    }

    res2 = await fetch(`${isDebug ? 'http' : 'https'}://${goodHost}`)
    await wait(500)
  }
  assert.equal(res2.status, 200)

  const badPort = 3000
  const badHost = sbx.getHost(badPort)
  // leave this here as a helper to visit host in browser
  console.log('badHost', 'https://' + badHost)

  // Test as non-browser user agent
  const res = await fetch(`${isDebug ? 'http' : 'https'}://${badHost}`)
  assert.equal(res.status, 502)
  const resp_text = await res.text()
  const resp = JSON.parse(resp_text)
  const [cleanedSbxId] = sbx.sandboxId.split('-')

  assert.equal(resp.message, 'The sandbox is running but port is not open')
  assert.equal(cleanedSbxId, resp.sandboxId)
  assert.equal(resp.port, badPort)
})

test.skipIf(isDebug)('closed port in browser  ', async () => {
  const sbx = await Sandbox.create(template, { timeoutMs: 60_000 })
  const goodPort = 8000

  await sbx.commands.run(`python -m http.server ${goodPort}`, {
    background: true,
  })

  await wait(1000)

  const goodHost = sbx.getHost(goodPort)
  // leave this here as a helper to visit host in browser
  console.log('goodHost', 'https://' + goodHost)

  let res2 = await fetch(`${isDebug ? 'http' : 'https'}://${goodHost}`)

  for (let i = 0; i < 20; i++) {
    if (res2.status === 200) {
      break
    }

    res2 = await fetch(`${isDebug ? 'http' : 'https'}://${goodHost}`)
    await wait(500)
  }
  assert.equal(res2.status, 200)

  const badPort = 3000
  const badHost = sbx.getHost(badPort)
  // leave this here as a helper to visit host in browser
  console.log('badHost', 'https://' + badHost)

  // Test as browser user agent
  const res = await fetch(`${isDebug ? 'http' : 'https'}://${badHost}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  })
  assert.equal(res.status, 502)
  const resp_text = await res.text()
  assert(resp_text.includes('<title>Closed Port Error</title>'))
})
