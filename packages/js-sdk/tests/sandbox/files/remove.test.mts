import { assert, expect } from 'vitest'

import { NotFoundError } from '../../../src'
import { sandboxTest } from '../../setup.mjs'

sandboxTest('remove file', async ({ sandbox }) => {
  const filename = 'test_remove.txt'
  const content = 'This file will be removed.'

  await sandbox.files.write(filename, content)
  await sandbox.files.remove(filename)
  const exists = await sandbox.files.exists(filename)
  assert.isFalse(exists)
})

sandboxTest('remove non-existing file', async ({ sandbox }) => {
  const filename = 'non_existing_file.txt'

  await expect(sandbox.files.remove(filename)).rejects.toThrowError(NotFoundError)
})
