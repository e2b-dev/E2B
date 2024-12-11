import path from 'path'
import { assert, onTestFinished } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { WriteEntry } from '../../../src/sandbox/filesystem/index.js'

sandboxTest('write files', async ({ sandbox }) => {
  // Attempt to write with one file in array
  const info = await sandbox.files.write([{ path: 'one_test_file.txt', data: 'This is a test file.' }])
  assert.isTrue(Array.isArray(info))
  assert.equal(info[0].name, 'one_test_file.txt')
  assert.equal(info[0].type, 'file')
  assert.equal(info[0].path, `/home/user/one_test_file.txt`)

  // Attempt to write with multiple files in array
  let files: WriteEntry[] = []

  for (let i = 0; i < 10; i++) {
    let path = ''
    if (i % 2 == 0) {
      path = `/${i}/multi_test_file_${i}.txt`
    } else {
      path = `/home/user/multi_test_file_${i}.txt`
    }

    onTestFinished(async () => await sandbox.files.remove(path))

    files.push({
      path: path,
      data: `This is a test file ${i}.`,
    })
  }

  const infos = await sandbox.files.write(files)

  assert.isTrue(Array.isArray(infos))
  assert.equal(infos.length, files.length)
  console.log('infos')
  console.log(infos)


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

sandboxTest('overwrite file', async ({ sandbox }) => {
  const filename = 'test_overwrite.txt'
  const initialContent = 'Initial content.'
  const newContent = 'New content.'

  await sandbox.files.write([{ path: filename, data: initialContent }])
  await sandbox.files.write([{ path: filename, data: newContent }])
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, newContent)
})

sandboxTest('write to non-existing directory', async ({ sandbox }) => {
  const filename = 'non_existing_dir/test_write.txt'
  const content = 'This should succeed too.'

  const info = await sandbox.files.write([{ path: filename, data: content }])
  console.log('info')
  console.log(info)
  const exists = await sandbox.files.exists(filename)
  assert.isTrue(exists)
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, content)
})
