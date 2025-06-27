import { test } from 'vitest'

import Sandbox from '../../src/index.js'
import { isIntegrationTest, wait } from '../setup.js'

const heavyArray = new ArrayBuffer(256 * 1024 * 1024) // 256 MiB = 256 * 1024 * 1024 bytes
const view = new Uint8Array(heavyArray)
for (let i = 0; i < view.length; i++) {
  view[i] = Math.floor(Math.random() * 256)
}

const integrationTestTemplate = 'integration-test-v1'
const sanboxCount = 10

test.skipIf(!isIntegrationTest)(
  'stress test heavy file writes and reads',
  async () => {
    const promises: Array<Promise<string | void>> = []
    for (let i = 0; i < sanboxCount; i++) {
      promises.push(
        Sandbox.create(integrationTestTemplate, { timeoutMs: 60 })
          .then((sbx) => {
            console.log(sbx.sandboxId)
            return sbx.files
              .write('heavy-file', heavyArray)
              .then(() => sbx.files.read('heavy-file'))
          })
          .catch(console.error)
      )
    }
    await wait(10_000)
    await Promise.all(promises)
  }
)

test.skipIf(!isIntegrationTest)('stress requests to nextjs app', async () => {
  const hostPromises: Array<Promise<string | void>> = []

  for (let i = 0; i < sanboxCount; i++) {
    hostPromises.push(
      Sandbox.create(integrationTestTemplate, { timeoutMs: 60_000 }).then(
        (sbx) => {
          console.log('created sandbox', sbx.sandboxId)
          return new Promise((resolve, reject) => {
            try {
              resolve(sbx.getHost(3000))
            } catch (e) {
              console.error('error getting sbx host', e)
              reject(e)
            }
          })
        }
      )
    )
  }

  await wait(10_000)
  const hosts = await Promise.all(hostPromises)

  const fetchPromises: Array<Promise<string | void>> = []

  for (let i = 0; i < 100; i++) {
    for (const host of hosts) {
      fetchPromises.push(
        new Promise((resolve) => {
          fetch('https://' + host)
            .then((res) => {
              console.log(`response for ${host}: ${res.status}`)
            })
            .then(resolve)
        })
      )
    }
  }

  await Promise.all(fetchPromises)
})
