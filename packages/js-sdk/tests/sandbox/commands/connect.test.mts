import { assert } from 'vitest'
import { sandboxTest } from '../../setup.mjs'

sandboxTest('connect to process', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('sleep 10', { background: true })
  const pid = cmd.pid

  const processInfo = await sandbox.commands.connect(pid)

  assert.isObject(processInfo)
  assert.equal(processInfo.pid, pid)
})

sandboxTest('connect to non-existing process', async ({ sandbox }) => {
  const nonExistingPid = 999999

  try {
    await sandbox.commands.connect(nonExistingPid)
  } catch (error) {
    assert.instanceOf(error, Error)
  }
})
