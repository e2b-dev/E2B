import { expect, assert } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { InvalidArgumentError, TimeoutError } from '../../../src/index.js'

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

sandboxTest('run without retaining output', async ({ sandbox }) => {
  const stdout: string[] = []
  const stderr: string[] = []

  const cmd = await sandbox.commands.run('echo out; echo err >&2', {
    retainOutput: false,
    onStdout: (data) => {
      stdout.push(data)
    },
    onStderr: (data) => {
      stderr.push(data)
    },
  })

  assert.equal(cmd.exitCode, 0)
  assert.isUndefined(cmd.stdout)
  assert.isUndefined(cmd.stderr)
  assert.equal(stdout.join(''), 'out\n')
  assert.equal(stderr.join(''), 'err\n')
})

sandboxTest(
  'run in background without retaining output',
  async ({ sandbox }) => {
    const handle = await sandbox.commands.run('echo out', {
      background: true,
      retainOutput: false,
    })

    const result = await handle.wait()

    assert.equal(result.exitCode, 0)
    assert.isUndefined(handle.stdout)
    assert.isUndefined(result.stdout)
    assert.isUndefined(result.stderr)
  }
)

sandboxTest('run with custom shell', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('print(6 * 7)', {
    shell: ['python3', '-c'],
  })

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout, '42\n')
})

sandboxTest('run with shell without args', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('$HOME', { shell: ['echo'] })

  assert.equal(cmd.exitCode, 0)
  assert.equal(cmd.stdout, '$HOME\n')
})

sandboxTest('run with empty shell', async ({ sandbox }) => {
  await expect(
    sandbox.commands.run('echo hello', { shell: [] })
  ).rejects.toThrowError(InvalidArgumentError)
})

sandboxTest('run with string shell', async ({ sandbox }) => {
  await expect(
    sandbox.commands.run('echo hello', {
      shell: '/bin/sh' as unknown as string[],
    })
  ).rejects.toThrowError(InvalidArgumentError)
})
