import { expect, test } from 'bun:test'

import { Sandbox } from '../../../src'

test('Bun test', async () => {
  const sbx = await Sandbox.create('base', { timeoutMs: 5_000 })
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
})
