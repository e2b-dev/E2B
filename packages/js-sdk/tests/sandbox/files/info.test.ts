import { assert } from 'vitest'
import { expect } from 'vitest'
import { NotFoundError } from '../../../src/errors.js'

import { sandboxTest } from '../../setup.js'

sandboxTest('get info of a file', async ({ sandbox }) => {
  const filename = 'test_file.txt'

  await sandbox.files.write(filename, 'test')
  const info = await sandbox.files.getInfo(filename)
  const { stdout: currentPath } = await sandbox.commands.run('pwd')

  assert.equal(info.name, filename)
  assert.equal(info.type, 'file')
  assert.equal(info.path, currentPath.trim() + '/' + filename)
  assert.equal(info.size, 4)
  assert.equal(info.mode, 0o644)
  assert.equal(info.permissions, '-rw-r--r--')
  assert.equal(info.owner, 'user')
  assert.equal(info.group, 'user')
  assert.property(info, 'modifiedTime')
})

sandboxTest('get info of a file that does not exist', async ({ sandbox }) => {
  const filename = 'test_does_not_exist.txt'
  await expect(sandbox.files.getInfo(filename)).rejects.toThrow(NotFoundError)
})

sandboxTest('get info of a directory', async ({ sandbox }) => {
  const dirname = 'test_dir'

  await sandbox.files.makeDir(dirname)
  const info = await sandbox.files.getInfo(dirname)
  const { stdout: currentPath } = await sandbox.commands.run('pwd')

  assert.equal(info.name, dirname)
  assert.equal(info.type, 'dir')
  assert.equal(info.path, currentPath.trim() + '/' + dirname)
  assert.isAbove(info.size, 0)
  assert.equal(info.mode, 0o755)
  assert.equal(info.permissions, 'drwxr-xr-x')
  assert.equal(info.owner, 'user')
  assert.equal(info.group, 'user')
  assert.property(info, 'modifiedTime')
})

sandboxTest(
  'get info of a directory that does not exist',
  async ({ sandbox }) => {
    const dirname = 'test_does_not_exist_dir'

    await expect(sandbox.files.getInfo(dirname)).rejects.toThrow(NotFoundError)
  }
)

sandboxTest('get info of a symlink', async ({ sandbox }) => {
  const filename = 'test_file.txt'

  await sandbox.files.write(filename, 'test')
  const symlinkName = 'test_symlink.txt'
  await sandbox.commands.run(`ln -s ${filename} ${symlinkName}`)

  const info = await sandbox.files.getInfo(symlinkName)
  const { stdout: currentPath } = await sandbox.commands.run('pwd')
  assert.equal(info.name, symlinkName)
  assert.equal(info.symlinkTarget, currentPath.trim() + '/' + filename)
})
