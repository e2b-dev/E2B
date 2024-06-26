import { assert } from 'vitest'

import { sandboxTest } from '../../setup.mjs'

sandboxTest('read file', async ({ sandbox }) => {
  const filename = 'test_read.txt'
  const content = 'Hello, world!'

  await sandbox.files.write(filename, content)
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, content)
})

sandboxTest('read non-existing file', async ({ sandbox }) => {
  const filename = 'non_existing_file.txt'

  try {
    await sandbox.files.read(filename)
  } catch (error) {
    assert.instanceOf(error, Error)
  }
})
