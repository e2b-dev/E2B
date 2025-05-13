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
})

sandboxTest(
  'get info of a directory that does not exist',
  async ({ sandbox }) => {
    const dirname = 'test_does_not_exist_dir'

    await expect(sandbox.files.getInfo(dirname)).rejects.toThrow(NotFoundError)
  }
)
