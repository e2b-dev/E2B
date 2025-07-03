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

sandboxTest('default env vars', async ({ sandbox }) => {
  try {
    const cmd = await sandbox.commands.run('echo "$E2B_SANDBOX"')

    assert.equal(cmd.exitCode, 0)
    assert.equal(cmd.stdout.trim(), isDebug ? 'false' : 'true')

    const cmd2 = await sandbox.commands.run('cat /run/e2b/.E2B_SANDBOX')

    assert.equal(cmd2.exitCode, 0)
    assert.equal(cmd2.stdout.trim(), isDebug ? 'false' : 'true')

    if (!isDebug) {
      const cmd3 = await sandbox.commands.run('echo "$E2B_SANDBOX_ID"')

      assert.equal(cmd3.exitCode, 0)
      assert.equal(cmd3.stdout.trim(), sandbox.sandboxId.split('-')[0])

      const cmd4 = await sandbox.commands.run('cat /run/e2b/.E2B_SANDBOX_ID')

      assert.equal(cmd4.exitCode, 0)
      assert.equal(cmd4.stdout.trim(), sandbox.sandboxId.split('-')[0])
    }
  } finally {
    await sandbox.kill()
  }
})
