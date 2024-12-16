import { assert } from 'vitest'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug } from '../setup.js'

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox',
  async ({ sandbox }) => {
    assert.isTrue(await sandbox.isRunning())

    await sandbox.pause()

    assert.isFalse(await sandbox.isRunning())

    await Sandbox.resume(sandbox.sandboxId)

    assert.isTrue(await sandbox.isRunning())
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox with env vars',
  async ({ template }) => {
    // Environment variables of a process exist at runtime, and are not stored in some file or so.
    // They are stored in the process's own memory
    const sandbox = await Sandbox.create(template, {
      envs: { TEST_VAR: 'sfisback' },
    })

    try {
      const cmd = await sandbox.commands.run('echo "$TEST_VAR"')

      assert.equal(cmd.exitCode, 0)
      assert.equal(cmd.stdout.trim(), 'sfisback')
    } catch {
      sandbox.kill()
    }

    await sandbox.pause()
    assert.isFalse(await sandbox.isRunning())

    await Sandbox.resume(sandbox.sandboxId)
    assert.isTrue(await sandbox.isRunning())

    try {
      const cmd = await sandbox.commands.run('echo "$TEST_VAR"')

      assert.equal(cmd.exitCode, 0)
      assert.equal(cmd.stdout.trim(), 'sfisback')
    } finally {
      await sandbox.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox with file',
  async ({ sandbox }) => {
    const filename = 'test_snapshot.txt'
    const content = 'This is a snapshot test file.'

    const info = await sandbox.files.write(filename, content)
    assert.equal(info.name, filename)
    assert.equal(info.type, 'file')
    assert.equal(info.path, `/home/user/${filename}`)

    const exists = await sandbox.files.exists(filename)
    assert.isTrue(exists)
    const readContent = await sandbox.files.read(filename)
    assert.equal(readContent, content)

    await sandbox.pause()
    assert.isFalse(await sandbox.isRunning())

    await Sandbox.resume(sandbox.sandboxId)
    assert.isTrue(await sandbox.isRunning())

    const exists2 = await sandbox.files.exists(filename)
    assert.isTrue(exists2)
    const readContent2 = await sandbox.files.read(filename)
    assert.equal(readContent2, content)
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox with long running process',
  async ({ sandbox }) => {
    const filename = 'test_long_running.txt'

    sandbox.commands.run(`sleep 2 && echo "done" > /home/user/${filename}`, {
      background: true,
    })

    // the file should not exist before 2 seconds have elapsed
    const exists = await sandbox.files.exists(filename)
    assert.isFalse(exists)

    await sandbox.pause()
    assert.isFalse(await sandbox.isRunning())

    await Sandbox.resume(sandbox.sandboxId)
    assert.isTrue(await sandbox.isRunning())

    // the file should be created after more than 2 seconds have elapsed
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const exists2 = await sandbox.files.exists(filename)
    assert.isTrue(exists2)
    const readContent2 = await sandbox.files.read(filename)
    assert.equal(readContent2.trim(), 'done')
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox with http server',
  async ({ sandbox }) => {
    await sandbox.commands.run('python3 -m http.server 8000', {
      background: true,
    })

    let url = await sandbox.getHost(8000)

    await new Promise((resolve) => setTimeout(resolve, 3000))

    const response1 = await fetch(`https://${url}`)
    assert.equal(response1.status, 200)

    await sandbox.pause()
    assert.isFalse(await sandbox.isRunning())

    await Sandbox.resume(sandbox.sandboxId)
    assert.isTrue(await sandbox.isRunning())

    url = await sandbox.getHost(8000)
    const response2 = await fetch(`https://${url}`)
    assert.equal(response2.status, 200)
  }
)
