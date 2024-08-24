import { assert, onTestFinished } from 'vitest'

import { sandboxTest } from '../../setup.js'

sandboxTest('list directory', async ({ sandbox }) => {
  const dirName = 'test_directory4'
  onTestFinished(() =>  sandbox.files.remove(dirName))

  await sandbox.files.makeDir(dirName)

  const files = await sandbox.files.list(dirName)
  assert.equal(files.length, 0)

  await sandbox.files.write('test_directory4/test_file', 'test')

  const files1 = await sandbox.files.list(dirName)
  assert.equal(files1.length, 1)
  assert.equal(files1[0].name, 'test_file')
  assert.equal(files1[0].type, 'file')
  assert.equal(files1[0].path, `/home/user/${dirName}/test_file`)

  const exists = await sandbox.files.exists(dirName)
  assert.isTrue(exists)
})
