import { assert } from 'vitest'

import { sandboxTest, isDebug } from '../setup.js'
import { Sandbox } from '../../src'

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox',
  async ({ sandbox }) => {
    assert.isTrue(await sandbox.isRunning())

    await sandbox.betaPause()

    assert.isFalse(await sandbox.isRunning())

    const resumedSandbox = await sandbox.connect()
    assert.equal(resumedSandbox.sandboxId, sandbox.sandboxId)

    assert.isTrue(await sandbox.isRunning())
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox with env vars',
  async ({ template, sandboxTestId }) => {
    // Environment variables of a process exist at runtime, and are not stored in some file or so.
    // They are stored in the process's own memory
    const sandbox = await Sandbox.create(template, {
      envs: { TEST_VAR: 'sfisback' },
      metadata: { sandboxTestId },
    })

    const cmd = await sandbox.commands.run('echo "$TEST_VAR"')

    assert.equal(cmd.exitCode, 0)
    assert.equal(cmd.stdout.trim(), 'sfisback')

    await sandbox.betaPause()

    assert.isFalse(await sandbox.isRunning())

    const resumedSandbox = await sandbox.connect()
    assert.isTrue(await sandbox.isRunning())
    assert.isTrue(await resumedSandbox.isRunning())
    assert.equal(resumedSandbox.sandboxId, sandbox.sandboxId)

    const cmd2 = await sandbox.commands.run('echo "$TEST_VAR"')

    assert.equal(cmd2.exitCode, 0)
    assert.equal(cmd2.stdout.trim(), 'sfisback')
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

    await sandbox.betaPause()
    assert.isFalse(await sandbox.isRunning())

    await sandbox.connect()
    assert.isTrue(await sandbox.isRunning())

    const exists2 = await sandbox.files.exists(filename)
    assert.isTrue(exists2)
    const readContent2 = await sandbox.files.read(filename)
    assert.equal(readContent2, content)
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox with ongoing long running process',
  async ({ sandbox }) => {
    const cmd = await sandbox.commands.run('sleep 3600', { background: true })
    const expectedPid = cmd.pid

    await sandbox.betaPause()
    assert.isFalse(await sandbox.isRunning())

    await sandbox.connect()
    assert.isTrue(await sandbox.isRunning())

    // First check that the command is in list
    const list = await sandbox.commands.list()
    assert.isTrue(list.some((c) => c.pid === expectedPid))

    // Make sure we can connect to it
    const processInfo = await sandbox.commands.connect(expectedPid)

    assert.isObject(processInfo)
    assert.equal(processInfo.pid, expectedPid)
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox with completed long running process',
  async ({ sandbox }) => {
    const filename = 'test_long_running.txt'

    await sandbox.commands.run(
      `sleep 2 && echo "done" > /home/user/${filename}`,
      {
        background: true,
      }
    )

    // the file should not exist before 2 seconds have elapsed
    const exists = await sandbox.files.exists(filename)
    assert.isFalse(exists)

    await sandbox.betaPause()
    assert.isFalse(await sandbox.isRunning())

    await sandbox.connect()
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

    await new Promise((resolve) => setTimeout(resolve, 5000))

    const response1 = await fetch(`https://${url}`)
    assert.equal(response1.status, 200)

    await sandbox.betaPause()
    assert.isFalse(await sandbox.isRunning())

    await sandbox.connect()
    assert.isTrue(await sandbox.isRunning())

    url = await sandbox.getHost(8000)
    const response2 = await fetch(`https://${url}`)
    assert.equal(response2.status, 200)
  }
)
