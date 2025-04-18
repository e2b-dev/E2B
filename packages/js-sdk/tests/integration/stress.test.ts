import { assert, test } from 'vitest'

import Sandbox, { components, CommandResult } from '../../src/index.js'
import { isIntegrationTest, wait } from '../setup.js'

const heavyArray = new ArrayBuffer(256 * 1024 * 1024) // 256 MiB = 256 * 1024 * 1024 bytes
const view = new Uint8Array(heavyArray)
for (let i = 0; i < view.length; i++) {
  view[i] = Math.floor(Math.random() * 256)
}

const integrationTestTemplate = 'integration-test-v1'
const sanboxCount = 10
const batchSize = 3

/*
test.skipIf(!isIntegrationTest)(
  'create a bunch of sandboxes and get metrics',
  async () => {
    const promises: Array<Promise<Sandbox | void>> = []
    for (let i = 0; i < sanboxCount; i++) {
      promises.push(
        Sandbox.create('base', { timeoutMs: 600 }).then(async (sbx) => {
          if (await sbx.isRunning()) {
            sbx.commands.run('yes', { background: true })
          } else {
            console.log('sandbox is not running', sbx.sandboxId)
          }
          return sbx
        })
      )
    }
    const sbxs = await Promise.all(promises)

    await wait(10_000)

    for (let i = 0; i < sbxs.length; i++) {
      // Process metrics in groups of 10 sandboxes
      if (i % batchSize === 0) {
        const metricsPromises: Array<
          Promise<components['schemas']['SandboxMetric'][]>
        > = sbxs.slice(i, i + batchSize).map((sbx) => {
          if (sbx) return sbx.getMetrics()
          return Promise.resolve([])
        })
        const metricsResults = await Promise.all(metricsPromises)

        console.log('metricsResults', metricsResults)
        // Log metrics for each sandbox in the group
        metricsResults.forEach((metrics, idx) => {
          const sbx = sbxs[i + idx]
          if (sbx) {
            console.log('##### metrics START#####->', i + idx)
            console.log('~~~', sbx.sandboxId)
            console.log(metrics)
            console.log('##### metrics END #####->', i + idx)
          }
        })
      }
      i++
      continue
    }
  },
  { timeout: 600_000 }
)

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

test.skipIf(!isIntegrationTest)('stress requests to nextjs app', async ({}) => {
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
*/

test.skipIf(!isIntegrationTest)(
  'long running sandbox process',
  async ({}) => {
    const sandboxPromises: Array<Promise<Sandbox>> = []
    let sandboxResults: Array<Sandbox> = []

    try {
      console.log('[Step 1] Creating sandboxes and long running commands')
      for (let i = 0; i < sanboxCount; i++) {
        sandboxPromises.push(Sandbox.create('base', { timeoutMs: 60_000 * 20 }))
      }

      sandboxResults = await Promise.all(sandboxPromises)

      await wait(2_000)

      console.log('[Step 2] Run long running commands')
      const cmdResults = await Promise.all(
        sandboxResults.map((sbx) => {
          console.log('starting long running command on sandbox', sbx.sandboxId)
          return sbx.commands.run('sleep 1000', { timeoutMs: 60_000 * 20 })
        })
      )

      await wait(2_000)

      console.log('[Step 3] Check exit codes of command results')
      await Promise.all(
        cmdResults.map((r) => {
          if (r && r.exitCode === 0) return r.exitCode
          assert.fail(
            'command result is undefined or exited with non-zero code',
            JSON.stringify({ r })
          )
        })
      )
    } finally {
      console.log('[Step 4] Kill sandboxes')
      try {
        await Promise.all(sandboxResults.map((sbx) => sbx?.kill()))
      } catch (e) {
        console.error('error killing sandboxes', e)
      }
    }
  },
  { timeout: 60_000 * 30 }
)
