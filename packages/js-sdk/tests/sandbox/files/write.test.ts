import { assert } from 'vitest'

import { sandboxTest } from '../../setup.js'

sandboxTest('write file', async ({ sandbox }) => {
  const filename = 'test_write.txt'
  const content = 'This is a test file.'

  const info = await sandbox.files.write(filename, content)
  assert.equal(info.name, filename)
  assert.equal(info.type, 'file')
  assert.equal(info.path, `/home/user/${filename}`)

  const exists = await sandbox.files.exists(filename)
  assert.isTrue(exists)
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, content)
})

sandboxTest('overwrite file', async ({ sandbox }) => {
  const filename = 'test_overwrite.txt'
  const initialContent = 'Initial content.'
  const newContent = 'New content.'

  await sandbox.files.write(filename, initialContent)
  await sandbox.files.write(filename, newContent)
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, newContent)
})

sandboxTest('write to non-existing directory', async ({ sandbox }) => {
  const filename = 'non_existing_dir/test_write.txt'
  const content = 'This should succeed too.'

  await sandbox.files.write(filename, content)
  const exists = await sandbox.files.exists(filename)
  assert.isTrue(exists)
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, content)
})
