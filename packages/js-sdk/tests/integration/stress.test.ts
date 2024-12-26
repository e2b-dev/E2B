import { test } from 'vitest'

import Sandbox from '../../src/index.js'
import { wait, isIntegrationTest } from '../setup.js'

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

test.skipIf(!isIntegrationTest)('stress network ingress', async ({}) => {
  const promises: Array<Promise<string | void>> = []

  for (let i = 0; i < sanboxCount; i++) {
    promises.push(
      Sandbox.create(integrationTestTemplate, { timeoutMs: 60 }).then((sbx) => {
        console.log('created sandbox', sbx.sandboxId)
        sbx.files
          .write('heavy-file', heavyArray)
          .then(() => {
            sbx.commands.run('python -m http.server 8000', { background: true })
          })
          .then(() => {
            new Promise((resolve, reject) => {
              try {
                resolve(sbx.getHost(8000))
              } catch (e) {
                console.error('error getting sbx host', e)
                reject(e)
              }
            }).then((host) => {
              const url = `https://${host}`
              console.log('fetching url', url)
              fetch(url)
            })

            try {
              sbx.kill()
            } catch (e) {
              console.error('error killing sbx', e)
            }
          })
      })
    )
  }

  await wait(10_000)
  await Promise.all(promises)
})

test.skipIf(!isIntegrationTest)('stress requests to nextjs app', async ({}) => {
  const promises: Array<Promise<string | void>> = []

  for (let i = 0; i < sanboxCount; i++) {
    promises.push(
      Sandbox.create(integrationTestTemplate, { timeoutMs: 60_000 })
        .then((sbx) => {
          console.log('created sandbox', sbx.sandboxId)
          return new Promise((resolve, reject) => {
            try {
              resolve(sbx.getHost(3000))
            } catch (e) {
              console.error('error getting sbx host', e)
              reject(e)
            }
          }).then(async (host) => {
            const url = `https://${host}`
            console.log('fetching url', url)
            await fetch(url).then(async (res) => {
              console.log('response', res.status)
              await res.text().then((text) => {
                console.log('response body', text)
              })
            })
          })
        })
        .catch(console.error)
    )
  }

  await wait(10_000)
  await Promise.all(promises)
})
