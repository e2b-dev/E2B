import { assert } from 'vitest'
import { sandboxTest } from '../../setup.mjs'

sandboxTest('kill process', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('sleep 10', { background: true })
  const pid = cmd.pid

  await sandbox.commands.kill(pid)

  try {
    await sandbox.commands.run(`kill -0 ${pid}`)
  } catch (error) {
    assert.instanceOf(error, Error)
  }
})

sandboxTest('kill non-existing process', async ({ sandbox }) => {
  const nonExistingPid = 999999

  try {
    await sandbox.commands.kill(nonExistingPid)
  } catch (error) {
    assert.instanceOf(error, Error)
  }
})
