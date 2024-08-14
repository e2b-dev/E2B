import { assert } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { Sandbox } from '../../../src'

sandboxTest('env vars', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('echo $FOO', { envs: { FOO: 'bar' } })

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout.trim(), 'bar')
})

sandboxTest('env vars on sandbox', async () => {
  const sandbox = await Sandbox.create({ envs: { FOO: 'bar' } })

  const cmd = await sandbox.commands.run('echo "$FOO"')

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout.trim(), 'bar')
})
