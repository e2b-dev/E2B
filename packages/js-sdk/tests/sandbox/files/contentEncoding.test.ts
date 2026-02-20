import { assert } from 'vitest'

import { WriteEntry } from '../../../src/sandbox/filesystem'
import { isDebug, sandboxTest } from '../../setup.js'

sandboxTest(
  'write and read file with gzip content encoding',
  async ({ sandbox }) => {
    const filename = 'test_gzip_write.txt'
    const content = 'This is a test file with gzip encoding.'

    const info = await sandbox.files.write(filename, content, {
      encoding: 'gzip',
    })
    assert.equal(info.name, filename)
    assert.equal(info.type, 'file')
    assert.equal(info.path, `/home/user/${filename}`)

    const readContent = await sandbox.files.read(filename, {
      encoding: 'gzip',
    })
    assert.equal(readContent, content)

    if (isDebug) {
      await sandbox.files.remove(filename)
    }
  }
)

sandboxTest(
  'write with gzip and read without encoding',
  async ({ sandbox }) => {
    const filename = 'test_gzip_write_plain_read.txt'
    const content = 'Written with gzip, read without.'

    await sandbox.files.write(filename, content, {
      encoding: 'gzip',
    })

    const readContent = await sandbox.files.read(filename)
    assert.equal(readContent, content)

    if (isDebug) {
      await sandbox.files.remove(filename)
    }
  }
)

sandboxTest('writeFiles with gzip content encoding', async ({ sandbox }) => {
  const files: WriteEntry[] = [
    { path: 'gzip_multi_1.txt', data: 'File 1 content' },
    { path: 'gzip_multi_2.txt', data: 'File 2 content' },
    { path: 'gzip_multi_3.txt', data: 'File 3 content' },
  ]

  const infos = await sandbox.files.writeFiles(files, {
    encoding: 'gzip',
  })

  assert.equal(infos.length, files.length)

  for (let i = 0; i < files.length; i++) {
    const readContent = await sandbox.files.read(files[i].path)
    assert.equal(readContent, files[i].data)
  }

  if (isDebug) {
    for (const file of files) {
      await sandbox.files.remove(file.path)
    }
  }
})

sandboxTest(
  'read file as bytes with gzip content encoding',
  async ({ sandbox }) => {
    const filename = 'test_gzip_bytes.txt'
    const content = 'Binary content with gzip.'

    await sandbox.files.write(filename, content)

    const readBytes = await sandbox.files.read(filename, {
      format: 'bytes',
      encoding: 'gzip',
    })
    assert.instanceOf(readBytes, Uint8Array)
    const decoded = new TextDecoder().decode(readBytes)
    assert.equal(decoded, content)

    if (isDebug) {
      await sandbox.files.remove(filename)
    }
  }
)
