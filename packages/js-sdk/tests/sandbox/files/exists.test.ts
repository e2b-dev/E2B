import { assert } from 'vitest'

import { sandboxTest } from '../../setup.js'

sandboxTest('file exists', async ({ sandbox }) => {
  const filename = 'test_exists.txt'

  await sandbox.files.write(filename, 'test')
  const exists = await sandbox.files.exists(filename)
  assert.isTrue(exists)
})

sandboxTest('file does not exist', async ({ sandbox }) => {
  const filename = 'test_does_not_exist.txt'

  const exists = await sandbox.files.exists(filename)
  assert.isFalse(exists)
})
