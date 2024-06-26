import { assert } from 'vitest'
import { ProcessExitError } from '../../../src/index.js'
import { sandboxTest } from '../../setup.mjs'

sandboxTest('send stdin to process', async ({ sandbox }) => {
  const text = 'Hello, World!'
  const cmd = await sandbox.commands.run('cat', { background: true })

  await sandbox.commands.sendStdin(cmd.pid, text)

  try {
    await cmd.kill()
  } catch (error) {
    assert.instanceOf(error, ProcessExitError)
  }

  assert.equal(cmd.stdout, text)
})

sandboxTest('send empty stdin to process', async ({ sandbox }) => {
  const text = ''
  const cmd = await sandbox.commands.run('cat', { background: true })

  await sandbox.commands.sendStdin(cmd.pid, text)

  try {
    await cmd.kill()
  } catch (error) {
    assert.instanceOf(error, ProcessExitError)
  }

  assert.equal(cmd.stdout, text)
})

sandboxTest('send special characters to stdin', async ({ sandbox }) => {
  const text = '!@#$%^&*()_+'
  const cmd = await sandbox.commands.run('cat', { background: true })

  await sandbox.commands.sendStdin(cmd.pid, text)

  try {
    await cmd.kill()
  } catch (error) {
    assert.instanceOf(error, ProcessExitError)
  }

  assert.equal(cmd.stdout, text)
})

sandboxTest('send multiline string to stdin', async ({ sandbox }) => {
  const text = 'Hello,\nWorld!'
  const cmd = await sandbox.commands.run('cat', { background: true })

  await sandbox.commands.sendStdin(cmd.pid, text)

  try {
    await cmd.kill()
  } catch (error) {
    assert.instanceOf(error, ProcessExitError)
  }

  assert.equal(cmd.stdout, text)
})
