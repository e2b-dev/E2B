import { assert, expect, expectTypeOf } from 'vitest'
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

sandboxTest('connect without retaining output', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('sleep 1; echo out', {
    background: true,
  })

  const stdout: string[] = []
  const handle = await sandbox.commands.connect(cmd.pid, {
    retainOutput: false,
    onStdout: (data) => {
      stdout.push(data)
    },
  })

  expectTypeOf(handle.stdout).toEqualTypeOf<undefined>()
  const result = await handle.wait()

  assert.isUndefined(result.stdout)
  assert.equal(stdout.join(''), 'out\n')
})
