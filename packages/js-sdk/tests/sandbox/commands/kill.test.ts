import { expect } from 'vitest'
import { ProcessExitError } from '../../../src/index.js'

import { sandboxTest } from '../../setup.js'

sandboxTest('kill process', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('sleep 10', { background: true })
  const pid = cmd.pid

  await sandbox.commands.kill(pid)

  await expect(sandbox.commands.run(`kill -0 ${pid}`)).rejects.toThrowError(
    ProcessExitError
  )
})

sandboxTest('kill non-existing process', async ({ sandbox }) => {
  const nonExistingPid = 999999

  await expect(sandbox.commands.kill(nonExistingPid)).resolves.toBe(false)
})
