import { expect, test } from 'bun:test'

import { Sandbox } from '../../../src'
import { template } from '../../template'
import { isDebug } from '../../setup'

test.skipIf(isDebug)(
  'Bun test',
  async () => {
    const sbx = await Sandbox.create(template, { timeoutMs: 5_000 })
    try {
      const isRunning = await sbx.isRunning()
      expect(isRunning).toBeTruthy()

      const text = 'Hello, World!'

      const cmd = await sbx.commands.run(`echo "${text}"`)

      expect(cmd.exitCode).toBe(0)
      expect(cmd.stdout).toEqual(`${text}\n`)
    } finally {
      await sbx.kill()
    }
  },
  { timeout: 20_000 }
)
