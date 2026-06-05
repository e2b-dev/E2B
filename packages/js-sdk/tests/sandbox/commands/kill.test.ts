import { expect } from 'vitest'
import { ProcessExitError } from '../../../src/index.js'

import { sandboxTest } from '../../setup.js'

sandboxTest('kill process', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('sleep 10', { background: true })
  const pid = cmd.pid

  await expect(sandbox.commands.kill(pid)).resolves.toBe(true)

  await expect(sandbox.commands.run(`kill -0 ${pid}`)).rejects.toThrowError(
    ProcessExitError
  )
})

sandboxTest('kill process tree', async ({ sandbox }) => {
  // Regression test for https://github.com/e2b-dev/E2B/issues/1034
  //
  // envd's SendSignal RPC only signals the single process it manages, so child
  // processes the command spawned used to keep running after kill(). Killing the
  // command must terminate its whole process tree.
  const cmd = await sandbox.commands.run('sleep 120 & sleep 120 & wait', {
    background: true,
  })

  // Capture the child PIDs while the leader is still alive.
  const children = await sandbox.commands.run(`pgrep -P ${cmd.pid}`)
  const childPids = children.stdout.split(/\s+/).filter(Boolean)
  expect(childPids).toHaveLength(2)

  await expect(cmd.kill()).resolves.toBe(true)

  // The leader and every child must be gone.
  await expect(sandbox.commands.run(`kill -0 ${cmd.pid}`)).rejects.toThrowError(
    ProcessExitError
  )
  const alive = await sandbox.commands.run(
    `for p in ${childPids.join(' ')}; do kill -0 $p 2>/dev/null && echo $p; done; true`
  )
  expect(alive.stdout.trim()).toBe('')
})

sandboxTest('kill non-existing process', async ({ sandbox }) => {
  const nonExistingPid = 999999

  await expect(sandbox.commands.kill(nonExistingPid)).resolves.toBe(false)
})
