import { assert, expect } from 'vitest'
import { sandboxTest } from '../../setup.js'

sandboxTest('connect to process', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('sleep 10', { background: true })
  const pid = cmd.pid

  const processInfo = await sandbox.commands.connect(pid)

  assert.isObject(processInfo)
  assert.equal(processInfo.pid, pid)
})

sandboxTest('connect to non-existing process', async ({ sandbox }) => {
  const nonExistingPid = 999999

  await expect(sandbox.commands.connect(nonExistingPid)).rejects.toThrowError()
})
