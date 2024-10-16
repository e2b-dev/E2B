import { assert } from 'vitest'

import { sandboxTest } from '../../setup.js'

sandboxTest('make directory', async ({ sandbox }) => {
  const dirName = 'test_directory1'

  await sandbox.files.makeDir(dirName)
  const exists = await sandbox.files.exists(dirName)
  assert.isTrue(exists)
})

sandboxTest('make existing directory', async ({ sandbox }) => {
  const dirName = 'test_directory2'

  await sandbox.files.makeDir(dirName)
  const exists = await sandbox.files.exists(dirName)
  assert.isTrue(exists)

  const exists2 = await sandbox.files.makeDir(dirName)
  assert.isFalse(exists2)
})

sandboxTest('make nested directory', async ({ sandbox }) => {
  const nestedDirName = 'test_directory3/nested_directory'

  await sandbox.files.makeDir(nestedDirName)
  const exists = await sandbox.files.exists(nestedDirName)
  assert.isTrue(exists)
})
