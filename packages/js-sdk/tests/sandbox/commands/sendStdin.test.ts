import { assert } from 'vitest'
import { sandboxTest, wait } from '../../setup.js'

sandboxTest('send stdin to process', async ({ sandbox }) => {
  const text = 'Hello, World!'
  const cmd = await sandbox.commands.run('cat', { background: true })

  await sandbox.commands.sendStdin(cmd.pid, text)

  await cmd.kill()

  assert.equal(cmd.stdout, text)
})

sandboxTest('send empty stdin to process', async ({ sandbox }) => {
  const text = ''
  const cmd = await sandbox.commands.run('cat', { background: true })

  await sandbox.commands.sendStdin(cmd.pid, text)

  await cmd.kill()

  assert.equal(cmd.stdout, text)
})

sandboxTest('send special characters to stdin', async ({ sandbox }) => {
  const text = '!@#$%^&*()_+'
  const cmd = await sandbox.commands.run('cat', { background: true })

  await sandbox.commands.sendStdin(cmd.pid, text)

  await wait(5_000)

  await cmd.kill()

  assert.equal(cmd.stdout, text)
})

sandboxTest('send multiline string to stdin', async ({ sandbox }) => {
  const text = 'Hello,\nWorld!'
  const cmd = await sandbox.commands.run('cat', { background: true })

  await sandbox.commands.sendStdin(cmd.pid, text)

  await cmd.kill()

  assert.equal(cmd.stdout, text)
})
