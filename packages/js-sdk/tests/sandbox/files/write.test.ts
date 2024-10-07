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
  // Attempt to write with empty files array
  await sandbox.files
    .write([])
    .then((e) => {
      assert.isUndefined(e)
    })
    .catch((err) => {
      assert.instanceOf(err, Error)
      assert.include(err.message, 'Expected to receive information about written file')
    })

  // Attempt to write with patn and file array
  await sandbox.files
    .write('/path/to/file', [{ path: 'one_test_file.txt', data: 'This is a test file.' }])
    .then((e) => {
      assert.isUndefined(e)
    })
    .catch((err) => {
      assert.instanceOf(err, Error)
      assert.include(err.message, 'Cannot specify path with array of files')
    })

  // Attempt to write with one file in array
  const info = await sandbox.files.write([{ path: 'one_test_file.txt', data: 'This is a test file.' }])
  assert.isTrue(Array.isArray(info))
  assert.equal(info[0].name, 'one_test_file.txt')
  assert.equal(info[0].type, 'file')
  assert.equal(info[0].path, `/home/user/one_test_file.txt`)

  // Attempt to write with multiple files in array
  let files: Array<{ data: WriteData; path: string }> = []

  for (let i = 0; i < 10; i++) {
    const path = `multi_test_file${i}.txt`
    onTestFinished(async () => await sandbox.files.remove(path))

    files.push({
      path: `multi_test_file${i}.txt`,
      data: `This is a test file ${i}.`,
    })
  }

  const infos = await sandbox.files.write(files)

  assert.isTrue(Array.isArray(infos))
  assert.equal((infos as EntryInfo[]).length, files.length)

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const info = infos[i] as EntryInfo

    assert.equal(info.name, file.path)
    assert.equal(info.type, 'file')
    assert.equal(info.path, `/home/user/${file.path}`)

    const exists = await sandbox.files.exists(file.path)
    assert.isTrue(exists)
    const readContent = await sandbox.files.read(file.path)
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
