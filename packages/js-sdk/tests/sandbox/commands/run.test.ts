import { expect, assert, expectTypeOf } from 'vitest'

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

  expectTypeOf(cmd.stdout).toEqualTypeOf<undefined>()
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

    expectTypeOf(handle.stdout).toEqualTypeOf<undefined>()
    const result = await handle.wait()

    assert.equal(result.exitCode, 0)
    assert.isUndefined(handle.stdout)
    assert.isUndefined(result.stdout)
    assert.isUndefined(result.stderr)
  }
)

sandboxTest('run retains output by default', async ({ sandbox }) => {
  const cmd = await sandbox.commands.run('echo out', { retainOutput: true })

  expectTypeOf(cmd.stdout).toEqualTypeOf<string>()
  assert.equal(cmd.stdout, 'out\n')
})
