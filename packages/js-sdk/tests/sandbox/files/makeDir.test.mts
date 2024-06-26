import { assert } from 'vitest'

import { sandboxTest } from '../../setup.mjs'

sandboxTest('make directory', async ({ sandbox }) => {
  const dirName = 'test_directory'

  await sandbox.files.makeDir(dirName)
  const exists = await sandbox.files.exists(dirName)
  assert.isTrue(exists)
})

sandboxTest('make nested directory', async ({ sandbox }) => {
  const nestedDirName = 'test_directory/nested_directory'

  await sandbox.files.makeDir(nestedDirName)
  const exists = await sandbox.files.exists(nestedDirName)
  assert.isTrue(exists)
})
