import { assert } from 'vitest'

import { sandboxTest, isDebug, template } from '../../setup.js'
import { Sandbox } from '../../../src'

sandboxTest.skipIf(isDebug)('sandbox global env vars', async () => {
  const sandbox = await Sandbox.create(template, { envs: { FOO: 'bar' } })
  const cmd = await sandbox.commands.run('echo $FOO')

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout.trim(), 'bar')
})

sandboxTest('bash command scoped env vars', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('echo $FOO', {
    envs: { FOO: 'bar' },
  })

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout.trim(), 'bar')

  // test that it is secure and not accessible to subsequent commands
  const cmd2 = await sandbox.commands.run('sudo echo "$FOO"')
  assert.equal(cmd2.exitCode, 0)
  assert.equal(cmd2.stdout.trim(), '')
})

sandboxTest('python command scoped env vars', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run(
    'python3 -c "import os; print(os.environ[\'FOO\'])"',
    { envs: { FOO: 'bar' } }
  )

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout.trim(), 'bar')
})
