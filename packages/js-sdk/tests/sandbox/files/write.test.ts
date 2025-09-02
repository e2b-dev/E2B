import path from 'path'
import { assert, onTestFinished } from 'vitest'

import { WriteEntry } from '../../../src/sandbox/filesystem'
import { isDebug, sandboxTest } from '../../setup.js'

sandboxTest('write file', async ({ sandbox }) => {
  const filename = 'test_write.txt'
  const content = 'This is a test file.'

  // Attempt to write with undefined path and content
  await sandbox.files
    // @ts-ignore
    .write(undefined, content)
    .then((e) => {
      assert.isUndefined(e)
    })
    .catch((err) => {
      assert.instanceOf(err, Error)
      assert.include(err.message, 'Path or files are required')
    })

  const info = await sandbox.files.write(filename, content)
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
  const emptyInfo = await sandbox.files.write([])
  assert.isTrue(Array.isArray(emptyInfo))
  assert.equal(emptyInfo.length, 0)

  // Attempt to write with undefined path and file array
  await sandbox.files
    // @ts-ignore
    .write(undefined, [
      { path: 'one_test_file.txt', data: 'This is a test file.' },
    ])
    .then((e) => {
      assert.isUndefined(e)
    })
    .catch((err) => {
      assert.instanceOf(err, Error)
      assert.include(err.message, 'Path or files are required')
    })

  // Attempt to write with path and file array
  await sandbox.files
    // @ts-ignore
    .write('/path/to/file', [
      { path: 'one_test_file.txt', data: 'This is a test file.' },
    ])
    .then((e) => {
      assert.isUndefined(e)
    })
    .catch((err) => {
      assert.instanceOf(err, Error)
      assert.include(
        err.message,
        'Cannot specify both path and array of files. You have to specify either path and data for a single file or an array for multiple files.'
      )
    })

  // Attempt to write with one file in array
  const info = await sandbox.files.write([
    { path: 'one_test_file.txt', data: 'This is a test file.' },
  ])
  assert.isTrue(Array.isArray(info))
  assert.equal(info[0].name, 'one_test_file.txt')
  assert.equal(info[0].type, 'file')
  assert.equal(info[0].path, '/home/user/one_test_file.txt')

  // Attempt to write with multiple files in array
  const files: WriteEntry[] = []

  for (let i = 0; i < 10; i++) {
    let path = ''
    if (i % 2 == 0) {
      path = `/${i}/multi_test_file${i}.txt`
    } else {
      path = `/home/user/multi_test_file${i}.txt`
    }

    if (isDebug) {
      onTestFinished(async () => await sandbox.files.remove(path))
    }

    files.push({
      path: path,
      data: `This is a test file ${i}.`,
    })
  }

  const infos = await sandbox.files.write(files)

  assert.isTrue(Array.isArray(infos))
  assert.equal(infos.length, files.length)

  // Attempt to write with multiple files in array
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const info = infos[i]

    assert.equal(info.name, path.basename(file.path))
    assert.equal(info.path, file.path)
    assert.equal(info.type, 'file')

    const exists = await sandbox.files.exists(file.path)
    assert.isTrue(exists)
    const readContent = await sandbox.files.read(file.path)
    assert.equal(readContent, file.data)
  }
})

sandboxTest('write file', async ({ sandbox }) => {
  const filename = 'test_write.txt'
  const content = 'This is a test file.'

  const info = await sandbox.files.write(filename, content)
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
