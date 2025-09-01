import { assert } from 'vitest'
import { sandboxTest } from '../../setup.js'

sandboxTest('list processes', async ({ sandbox }) => {
  // Start them firsts
  await sandbox.commands.run('sleep 10', { background: true })
  await sandbox.commands.run('sleep 10', { background: true })

  const processes = await sandbox.commands.list()

  assert.isArray(processes)
  assert.isAtLeast(processes.length, 2)

  processes.forEach((process) => {
    assert.containsAllKeys(process, ['pid'])
  })
})
