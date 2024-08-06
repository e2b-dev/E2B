import { assert } from 'vitest'

import { sandboxTest } from '../../setup.js'

sandboxTest('remove file', async ({ sandbox }) => {
  const filename = 'test_remove.txt'
  const content = 'This file will be removed.'

  await sandbox.files.write(filename, content)
  const info = await sandbox.files.remove(filename)
  assert.equal(info.name, filename)
  assert.equal(info.type, 'file')
  assert.equal(info.path, `/home/user/${filename}`)

  const exists = await sandbox.files.exists(filename)
  assert.isFalse(exists)
})

sandboxTest('remove non-existing file', async ({ sandbox }) => {
  const filename = 'non_existing_file.txt'

  await sandbox.files.remove(filename)
})
