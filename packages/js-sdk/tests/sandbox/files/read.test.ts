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

sandboxTest('read empty file in all formats', async ({ sandbox }) => {
  const filename = 'empty-file-formats.txt'
  await sandbox.commands.run(`touch ${filename}`)

  const text = await sandbox.files.read(filename, { format: 'text' })
  expect(text).toBe('')

  const bytes = await sandbox.files.read(filename, { format: 'bytes' })
  expect(bytes).toBeInstanceOf(Uint8Array)
  expect(bytes.length).toBe(0)

  const blob = await sandbox.files.read(filename, { format: 'blob' })
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.size).toBe(0)

  const stream = await sandbox.files.read(filename, { format: 'stream' })
  expect(stream).toBeInstanceOf(ReadableStream)
  const chunks: Uint8Array[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  expect(Buffer.concat(chunks).length).toBe(0)
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

sandboxTest('read empty file in all formats', async ({ sandbox }) => {
  const filename = 'empty-file-formats.txt'
  await sandbox.commands.run(`touch ${filename}`)

  const text = await sandbox.files.read(filename, { format: 'text' })
  expect(text).toBe('')

  const bytes = await sandbox.files.read(filename, { format: 'bytes' })
  expect(bytes).toBeInstanceOf(Uint8Array)
  expect(bytes.length).toBe(0)

  const blob = await sandbox.files.read(filename, { format: 'blob' })
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.size).toBe(0)

  const stream = await sandbox.files.read(filename, { format: 'stream' })
  expect(stream).toBeInstanceOf(ReadableStream)
  const chunks: Uint8Array[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  expect(Buffer.concat(chunks).length).toBe(0)
})
