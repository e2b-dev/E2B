import { assert, expect } from 'vitest'

import { NotFoundError } from '../../../src'
import { sandboxTest } from '../../setup.mjs'

sandboxTest('rename file', async ({ sandbox }) => {
  const oldFilename = 'test_rename_old.txt'
  const newFilename = 'test_rename_new.txt'
  const content = 'This file will be renamed.'

  await sandbox.files.write(oldFilename, content)
  await sandbox.files.rename(oldFilename, newFilename)
  const existsOld = await sandbox.files.exists(oldFilename)
  const existsNew = await sandbox.files.exists(newFilename)
  assert.isFalse(existsOld)
  assert.isTrue(existsNew)
  const readContent = await sandbox.files.read(newFilename)
  assert.equal(readContent, content)
})

sandboxTest('rename non-existing file', async ({ sandbox }) => {
  const oldFilename = 'non_existing_file.txt'
  const newFilename = 'new_non_existing_file.txt'

  await expect(sandbox.files.rename(oldFilename, newFilename)).rejects.toThrowError(NotFoundError)
})
