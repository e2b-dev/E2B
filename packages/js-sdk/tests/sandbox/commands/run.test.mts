import { assert } from 'vitest'
import { sandboxTest } from '../../setup.mjs'

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
