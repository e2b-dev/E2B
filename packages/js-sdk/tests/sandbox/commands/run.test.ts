import { expect, assert } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { TimeoutError } from '../../../src/index.js'

sandboxTest('run', async ({ sandbox }) => {
  const text = 'Hello, World!'

  const cmd = await sandbox.commands.run(`echo "${text}"`)

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout, `${text}\n`)
})

sandboxTest('run with special characters', async ({ sandbox }) => {
  const text = '!@#$%^&*()_+'

  const cmd = await sandbox.commands.run(`echo "${text}"`)

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout, `${text}\n`)
})

sandboxTest('run with multiline string', async ({ sandbox }) => {
  const text = 'Hello,\nWorld!'

  const cmd = await sandbox.commands.run(`echo "${text}"`)

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout, `${text}\n`)
})

sandboxTest('run with timeout', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('echo "Hello, World!"', {
    timeoutMs: 4000,
  })

  assert.equal(cmd.exitCode, 0)
})

sandboxTest('run with too short timeout', async ({ sandbox }) => {
  await expect(
    sandbox.commands.run('sleep 10', { timeoutMs: 1000 })
  ).rejects.toThrow()
})

sandboxTest('run with too short timeout iterating', async ({ sandbox }) => {
  const handle = await sandbox.commands.run('sleep 10', {
    timeoutMs: 2000,
    background: true,
  })

  await expect(handle.wait()).rejects.toThrowError(TimeoutError)
})
