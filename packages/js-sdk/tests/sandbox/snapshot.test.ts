import { assert, expect } from 'vitest'
import { randomBytes } from 'crypto'

import { Sandbox } from '../../src'
import { sandboxTest, isDebug, wait } from '../setup.js'

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox',
  async ({ sandbox }) => {
    assert.isTrue(await sandbox.isRunning())

    await sandbox.pause()

    assert.isFalse(await sandbox.isRunning())

    await Sandbox.connect(sandbox.sandboxId, { autoPause: true })

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
      autoPause: true,
    })

    const cmd = await sandbox.commands.run('echo "$TEST_VAR"')

    try {
      assert.equal(cmd.exitCode, 0)
      assert.equal(cmd.stdout.trim(), 'sfisback')
    } catch {
      await sandbox.kill()
    }

    await sandbox.pause()

    assert.isFalse(await sandbox.isRunning())

    await Sandbox.connect(sandbox.sandboxId, { autoPause: true })
    assert.isTrue(await sandbox.isRunning())

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

    await sandbox.pause()
    assert.isFalse(await sandbox.isRunning())

    await Sandbox.connect(sandbox.sandboxId, { autoPause: true })
    assert.isTrue(await sandbox.isRunning())

    const exists2 = await sandbox.files.exists(filename)
    assert.isTrue(exists2)
    const readContent2 = await sandbox.files.read(filename)
    assert.equal(readContent2, content)
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox with ongoing long running process',
  async ({ sandbox, onTestFinished }) => {
    const cmd = await sandbox.commands.run('sleep 3600', { background: true })
    const expectedPid = cmd.pid

    await sandbox.pause()
    assert.isFalse(await sandbox.isRunning())

    await Sandbox.connect(sandbox.sandboxId, { autoPause: true })
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
  async ({ sandbox, onTestFinished }) => {
    const filename = 'test_long_running.txt'

    const cmd = await sandbox.commands.run(
      `sleep 2 && echo "done" > /home/user/${filename}`,
      {
        background: true,
      }
    )

    // the file should not exist before 2 seconds have elapsed
    const exists = await sandbox.files.exists(filename)
    assert.isFalse(exists)

    await sandbox.pause()
    assert.isFalse(await sandbox.isRunning())

    await Sandbox.connect(sandbox.sandboxId, { autoPause: true })
    assert.isTrue(await sandbox.isRunning())

    // the file should be created after more than 2 seconds have elapsed
    await new Promise((resolve) => setTimeout(resolve, 3500))

    const exists2 = await sandbox.files.exists(filename)
    assert.isTrue(exists2)
    const readContent2 = await sandbox.files.read(filename)
    assert.equal(readContent2.trim(), 'done')
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox with http server',
  async ({ sandbox, onTestFinished }) => {
    const cmd = await sandbox.commands.run('python3 -m http.server 8000', {
      background: true,
    })

    let url = sandbox.getHost(8000)

    await new Promise((resolve) => setTimeout(resolve, 5000))

    const response1 = await fetch(`https://${url}`)
    assert.equal(response1.status, 200)

    await sandbox.pause()
    assert.isFalse(await sandbox.isRunning())

    await Sandbox.connect(sandbox.sandboxId, { autoPause: true })
    assert.isTrue(await sandbox.isRunning())

    url = sandbox.getHost(8000)
    const response2 = await fetch(`https://${url}`)
    assert.equal(response2.status, 200)

    onTestFinished(() => {
      sandbox.commands.kill(cmd.pid)
    })
  }
)

sandboxTest.skipIf(isDebug)(
  'resume a sandbox with auto pause',
  async ({ sandbox }) => {
    await sandbox.pause()

    const timeout = 1_000
    const sbxResumed = await Sandbox.connect(sandbox.sandboxId, {
      timeoutMs: timeout,
      autoPause: true,
    })
    await sbxResumed.files.write('test.txt', 'test')

    // Wait for the sandbox to pause and create snapshot
    await wait(timeout + 5_000)

    const sbxResumed2 = await Sandbox.connect(sandbox.sandboxId, {
      timeoutMs: timeout,
      autoPause: true,
    })

    try {
      await expect(sbxResumed2.files.read('test.txt')).resolves.toEqual('test')
    } finally {
      await sbxResumed2.kill()
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'pause and resume a sandbox while flushing the filesystem cache',
  async ({ sandbox }) => {
    const testPath = '/home/user/test'
    const testContent = randomBytes(512).toString('hex')

    await sandbox.files.write(testPath, testContent)

    // sync: from the man page: flush file system buffers. Force changed blocks to disk, update the super block
    // echo 3 > /proc/sys/vm/drop_cache: from the kernel docs: this will cause the kernel to free pagecache, dentries and inodes
    await sandbox.commands.run(
      'sync && echo 3 | sudo tee /proc/sys/vm/drop_caches'
    )

    await sandbox.pause()

    const resumedSbx = await Sandbox.connect(sandbox.sandboxId, {
      autoPause: true,
    })

    const contentAfter = await resumedSbx.files.read(testPath)

    assert.equal(contentAfter, testContent)
  }
)
