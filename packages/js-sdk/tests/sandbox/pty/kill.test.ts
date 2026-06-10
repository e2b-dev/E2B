import { sandboxTest } from '../../setup'
import { assert, expect } from 'vitest'
import { ProcessExitError } from '../../../src/index.js'

sandboxTest('kill PTY', async ({ sandbox }) => {
  const terminal = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    onData: () => {},
  })

  const result = await sandbox.pty.kill(terminal.pid)
  assert.isTrue(result)

  // The PTY process should no longer be running.
  await expect(
    sandbox.commands.run(`kill -0 ${terminal.pid}`)
  ).rejects.toThrowError(ProcessExitError)
})

sandboxTest('kill non-existing PTY', async ({ sandbox }) => {
  const nonExistingPid = 999999

  await expect(sandbox.pty.kill(nonExistingPid)).resolves.toBe(false)
})
