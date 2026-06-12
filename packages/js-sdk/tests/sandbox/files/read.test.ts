import { expect, assert } from 'vitest'

import { FileNotFoundError, NotFoundError } from '../../../src'
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

sandboxTest('read file as stream', async ({ sandbox }) => {
  const filename = 'test_read_stream.txt'
  const content = 'Streamed read content. '.repeat(10_000)

  await sandbox.files.write(filename, content)
  const stream = await sandbox.files.read(filename, { format: 'stream' })

  const chunks: Uint8Array[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  const readContent = Buffer.concat(chunks).toString('utf-8')
  assert.equal(readContent, content)
})

sandboxTest('read non-existing file as stream', async ({ sandbox }) => {
  const filename = 'non_existing_file.txt'

  await expect(
    sandbox.files.read(filename, { format: 'stream' })
  ).rejects.toThrowError(FileNotFoundError)
})
