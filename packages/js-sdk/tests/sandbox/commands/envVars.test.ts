import { assert } from 'vitest'

import { sandboxTest, isDebug } from '../../setup.js'
import { Sandbox } from '../../../src'

sandboxTest.skipIf(isDebug)('env vars', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('echo $FOO', { envs: { FOO: 'bar' } })

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout.trim(), 'bar')
})

sandboxTest.skipIf(isDebug)('env vars on sandbox', async ({ template }) => {
  const sandbox = await Sandbox.create(template, { envs: { FOO: 'bar' } })

  try {
    const cmd = await sandbox.commands.run('echo "$FOO"')

    assert.equal(cmd.exitCode, 0)
    assert.equal(cmd.stdout.trim(), 'bar')
  } finally {
    await sandbox.kill()
  }
})

sandboxTest.skipIf(isDebug)('default env vars present', async ({ sandbox }) => {
  const result = await sandbox.commands.run('echo $E2B_SANDBOX')
  assert.equal(result?.stdout.trim(), 'true')
})
