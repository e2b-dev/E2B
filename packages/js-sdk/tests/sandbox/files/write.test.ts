import { assert, onTestFinished } from 'vitest'

import { EntryInfo } from '../../../src/index.js'
import { WriteData } from '../../../src/sandbox/filesystem/index.js'
import { sandboxTest } from '../../setup.js'

sandboxTest('write file', async ({ sandbox }) => {
  const filename = 'test_write.txt'
  const content = 'This is a test file.'

  const info = (await sandbox.files.write(filename, content)) as EntryInfo
  assert.isFalse(Array.isArray(info))
  assert.equal(info.name, filename)
  assert.equal(info.type, 'file')
  assert.equal(info.path, `/home/user/${filename}`)

  const exists = await sandbox.files.exists(filename)
  assert.isTrue(exists)
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, content)
})

sandboxTest('write multiple files', async ({ sandbox }) => {
  let files: Array<{ data: WriteData; filename: string }> = []

  for (let i = 0; i < 10; i++) {
    const filename = `multi_test_file${i}.txt`
    onTestFinished(async () => await sandbox.files.remove(filename))

    files.push({
      filename: `multi_test_file${i}.txt`,
      data: `This is a test file ${i}.`,
    })
  }

  const infos = await sandbox.files.write('', files)

  assert.isTrue(Array.isArray(infos))
  assert.equal((infos as EntryInfo[]).length, files.length)

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const info = infos[i] as EntryInfo

    assert.equal(info.name, file.filename)
    assert.equal(info.type, 'file')
    assert.equal(info.path, `/home/user/${file.filename}`)

    const exists = await sandbox.files.exists(file.filename)
    assert.isTrue(exists)
    const readContent = await sandbox.files.read(file.filename)
    assert.equal(readContent, file.data)
  }
})

sandboxTest('write file', async ({ sandbox }) => {
  const filename = 'test_write.txt'
  const content = 'This is a test file.'

  const info = (await sandbox.files.write(filename, content)) as EntryInfo
  assert.isFalse(Array.isArray(info))
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
