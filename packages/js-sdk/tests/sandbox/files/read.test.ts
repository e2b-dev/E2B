import { expect, assert } from 'vitest'

import { NotFoundError } from '../../../src'
import { sandboxTest } from '../../setup.js'

sandboxTest('read file', async ({ sandbox }) => {
  const filename = 'test_read.txt'
  const content = 'Hello, world!'

  await sandbox.files.write(filename, content)
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, content)
})

sandboxTest('read non-existing file', async ({ sandbox }) => {
  const filename = 'non_existing_file.txt'

  await expect(sandbox.files.read(filename)).rejects.toThrowError(NotFoundError)
})

sandboxTest('empty file', async ({ sandbox }) => {
  const filename = 'empty-file.txt'

  await sandbox.commands.run(`touch ${filename}`)
  const content = await sandbox.files.read(filename)
  expect(content).toBe('')
})
