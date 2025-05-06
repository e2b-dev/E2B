import { assert } from 'vitest'

import { sandboxTest, isDebug, template } from '../../setup.js'
import { Sandbox } from '../../../src'

sandboxTest.skipIf(isDebug)('env vars', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('echo $FOO', { envs: { FOO: 'bar' } })

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout.trim(), 'bar')
})

sandboxTest.skipIf(isDebug)('env vars on sandbox', async () => {
  const sandbox = await Sandbox.create(template, { envs: { FOO: 'bar' } })

  try {
    const cmd = await sandbox.commands.run('echo "$FOO"')

    assert.equal(cmd.exitCode, 0)
    assert.equal(cmd.stdout.trim(), 'bar')
  } finally {
    await sandbox.kill()
  }
})
