import { expect } from 'vitest'

import { sandboxTest, isDebug, isIntegrationTest } from '../setup.js'
import { Sandbox } from '../../src'
import { wait } from '../setup.js'

sandboxTest('kill existing sandbox', async ({ sandbox }) => {
  const sbx = await Sandbox.create('base', { timeoutMs: 120_000 })

  const handle = await sbx.commands.run('sleep 10', { background: true })
  await handle.kill()

  //expect(handle.stdout).toBe('')
  //expect(handle.stderr).toBe('')

  const psHandle = await sbx.commands.run('ps aux', { background: true })
  console.log(psHandle.stdout)

  await wait(10_000)
})
