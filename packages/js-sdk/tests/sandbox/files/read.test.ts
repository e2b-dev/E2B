import { expect, assert } from 'vitest'

import {
  FileNotFoundError,
  InvalidArgumentError,
  NotFoundError,
} from '../../../src'
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

  await expect(sandbox.files.read(filename)).rejects.toThrowError(
    FileNotFoundError
  )
})

sandboxTest(
  'read non-existing file catches with deprecated NotFoundError',
  async ({ sandbox }) => {
    const filename = 'non_existing_file.txt'

    await expect(sandbox.files.read(filename)).rejects.toThrowError(
      NotFoundError
    )
  }
)

sandboxTest('empty file', async ({ sandbox }) => {
  const filename = 'empty-file.txt'

  await sandbox.commands.run(`touch ${filename}`)
  const content = await sandbox.files.read(filename)
  expect(content).toBe('')
})

sandboxTest('read with start and end', async ({ sandbox }) => {
  const filename = 'test_read_range.txt'
  const content = 'Hello, world!'

  await sandbox.files.write(filename, content)
  const sliced = await sandbox.files.read(filename, { start: 7, end: 11 })
  assert.equal(sliced, 'world')
})

sandboxTest('read with start only', async ({ sandbox }) => {
  const filename = 'test_read_start.txt'
  const content = 'Hello, world!'

  await sandbox.files.write(filename, content)
  const sliced = await sandbox.files.read(filename, { start: 7 })
  assert.equal(sliced, 'world!')
})

sandboxTest('read with end only', async ({ sandbox }) => {
  const filename = 'test_read_end.txt'
  const content = 'Hello, world!'

  await sandbox.files.write(filename, content)
  const sliced = await sandbox.files.read(filename, { end: 4 })
  assert.equal(sliced, 'Hello')
})

sandboxTest('read range as bytes', async ({ sandbox }) => {
  const filename = 'test_read_range_bytes.txt'
  const content = 'Hello, world!'

  await sandbox.files.write(filename, content)
  const sliced = await sandbox.files.read(filename, {
    format: 'bytes',
    start: 7,
    end: 11,
  })
  expect(new TextDecoder().decode(sliced)).toBe('world')
})

sandboxTest('read with invalid range rejects', async ({ sandbox }) => {
  const filename = 'test_read_invalid_range.txt'
  await sandbox.files.write(filename, 'data')

  await expect(
    sandbox.files.read(filename, { start: -1 })
  ).rejects.toThrowError(InvalidArgumentError)
  await expect(
    sandbox.files.read(filename, { start: 5, end: 2 })
  ).rejects.toThrowError(InvalidArgumentError)
  // Booleans must be rejected, not coerced into the Range header.
  await expect(
    // @ts-expect-error testing runtime guard against non-integer input
    sandbox.files.read(filename, { start: true })
  ).rejects.toThrowError(InvalidArgumentError)
  await expect(
    // @ts-expect-error testing runtime guard against non-integer input
    sandbox.files.read(filename, { end: false })
  ).rejects.toThrowError(InvalidArgumentError)
})
