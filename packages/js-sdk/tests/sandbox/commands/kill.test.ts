import { expect } from 'vitest'
import { CommandExitError } from '../../../src/index.js'

import { sandboxTest } from '../../setup.js'

sandboxTest('kill process', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('sleep 10', { background: true })
  const pid = cmd.pid

  await sandbox.commands.kill(pid)

  await expect(sandbox.commands.run(`kill -0 ${pid}`)).rejects.toThrowError(
    CommandExitError
  )
})

sandboxTest('kill non-existing process', async ({ sandbox }) => {
  const nonExistingPid = 999999

  await expect(sandbox.commands.kill(nonExistingPid)).resolves.toBe(false)
})

sandboxTest('kill via handle', async ({ sandbox }) => {
  const handle = await sandbox.commands.run('sleep 60', { background: true })
  const killed = await handle.kill()
  expect(killed).toBe(true)

  await expect(
    sandbox.commands.run(`kill -0 ${handle.pid}`)
  ).rejects.toThrowError(CommandExitError)
})

sandboxTest('kill handle wait raises promptly', async ({ sandbox }) => {
  const handle = await sandbox.commands.run('sleep 60', { background: true })
  await handle.kill()

  // Before the fix: handle.wait() blocks forever after kill() because
  // _iterateEvents keeps awaiting the stream after receiving the "end" event.
  // After the fix: wait() throws CommandExitError promptly.
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('wait() did not return within 5s')), 5000)
  )
  await expect(Promise.race([handle.wait(), timeout])).rejects.toBeInstanceOf(
    CommandExitError
  )
})
