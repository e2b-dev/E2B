import { assert, expect, test } from 'vitest'

import { sandboxTest, isDebug, TEST_API_KEY } from '../setup.js'
import { Sandbox } from '../../src'
import { InvalidArgumentError, NotFoundError } from '../../src/errors'

sandboxTest.skipIf(isDebug)('fork a sandbox', async ({ sandbox }) => {
  await sandbox.files.write('/home/user/state.txt', 'state before fork')

  const forks = await sandbox.fork()
  assert.equal(forks.length, 1)

  const fork = forks[0]
  assert.instanceOf(fork, Sandbox)
  if (!(fork instanceof Sandbox)) {
    return
  }

  try {
    assert.notEqual(fork.sandboxId, sandbox.sandboxId)

    // The original sandbox keeps running
    assert.isTrue(await sandbox.isRunning())
    assert.isTrue(await fork.isRunning())

    // The fork inherits the filesystem state
    const content = await fork.files.read('/home/user/state.txt')
    assert.equal(content, 'state before fork')

    // The fork is independent of the original
    await fork.files.write('/home/user/state.txt', 'modified in fork')
    const originalContent = await sandbox.files.read('/home/user/state.txt')
    assert.equal(originalContent, 'state before fork')
  } finally {
    await fork.kill()
  }
})

sandboxTest.skipIf(isDebug)(
  'fork a sandbox multiple times',
  async ({ sandbox }) => {
    const forks = await sandbox.fork({ count: 2, timeoutMs: 60_000 })
    assert.equal(forks.length, 2)

    const forkedSandboxes = forks.filter(
      (fork): fork is Sandbox => fork instanceof Sandbox
    )

    try {
      assert.equal(forkedSandboxes.length, 2)

      const ids = new Set(forkedSandboxes.map((s) => s.sandboxId))
      assert.equal(ids.size, 2)
      assert.isFalse(ids.has(sandbox.sandboxId))

      for (const fork of forkedSandboxes) {
        assert.isTrue(await fork.isRunning())
      }
    } finally {
      await Promise.all(forkedSandboxes.map((s) => s.kill()))
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'fork a sandbox by ID with the static method',
  async ({ sandbox }) => {
    const forks = await Sandbox.fork(sandbox.sandboxId)
    assert.equal(forks.length, 1)

    const fork = forks[0]
    assert.instanceOf(fork, Sandbox)
    if (fork instanceof Sandbox) {
      try {
        assert.isTrue(await fork.isRunning())
      } finally {
        await fork.kill()
      }
    }
  }
)

sandboxTest.skipIf(isDebug)('fork a killed sandbox fails', async () => {
  const sandbox = await Sandbox.create()
  await sandbox.kill()

  await expect(sandbox.fork()).rejects.toThrowError(NotFoundError)
})

test('fork with count lower than 1 fails', async () => {
  await expect(
    Sandbox.fork('sbx-test', { count: 0, apiKey: TEST_API_KEY })
  ).rejects.toThrowError(InvalidArgumentError)
})
