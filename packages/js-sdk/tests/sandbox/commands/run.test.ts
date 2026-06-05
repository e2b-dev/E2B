import { expect, assert } from 'vitest'

import { sandboxTest } from '../../setup.js'

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

sandboxTest(
  'background run is capped by timeout',
  async ({ sandbox }) => {
    const start = Date.now()
    const cmd = await sandbox.commands.run('sleep 20', {
      background: true,
      timeoutMs: 10_000,
    })
    await expect(cmd.wait()).rejects.toThrow()
    // The command is capped by the timeout instead of running for the full 20s.
    expect(Date.now() - start).toBeLessThan(20_000)
  },
  60_000
)

sandboxTest(
  'background run without timeout completes',
  async ({ sandbox }) => {
    // Background commands default to no timeout, so a long command completes.
    const cmd = await sandbox.commands.run('sleep 20', { background: true })
    const result = await cmd.wait()
    assert.equal(result.exitCode, 0)
  },
  60_000
)
