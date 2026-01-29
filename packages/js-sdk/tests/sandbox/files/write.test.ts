import path from 'path'
import { assert } from 'vitest'

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

  if (isDebug) {
    await sandbox.files.remove(filename)
  }
})

sandboxTest('write multiple files', async ({ sandbox }) => {
  const numTestFiles = 10

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

  for (let i = 0; i < numTestFiles; i++) {
    let path = ''
    if (i % 2 == 0) {
      path = `/${i}/multi_test_file${i}.txt`
    } else {
      path = `/home/user/multi_test_file${i}.txt`
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

  if (isDebug) {
    for (const file of files) {
      await sandbox.files.remove(file.path)
    }
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

  if (isDebug) {
    await sandbox.files.remove(filename)
  }
})

sandboxTest('overwrite file', async ({ sandbox }) => {
  const filename = 'test_overwrite.txt'
  const initialContent = 'Initial content.'
  const newContent = 'New content.'

  await sandbox.files.write(filename, initialContent)
  await sandbox.files.write(filename, newContent)
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, newContent)

  if (isDebug) {
    await sandbox.files.remove(filename)
  }
})

sandboxTest('write to non-existing directory', async ({ sandbox }) => {
  const filename = 'non_existing_dir/test_write.txt'
  const content = 'This should succeed too.'

  await sandbox.files.write(filename, content)
  const exists = await sandbox.files.exists(filename)
  assert.isTrue(exists)
  const readContent = await sandbox.files.read(filename)
  assert.equal(readContent, content)

  if (isDebug) {
    await sandbox.files.remove(filename)
  }
})

sandboxTest('writeFiles with empty array', async ({ sandbox }) => {
  const emptyInfo = await sandbox.files.writeFiles([])
  assert.isTrue(Array.isArray(emptyInfo))
  assert.equal(emptyInfo.length, 0)
})

sandboxTest('writeFiles with multiple files', async ({ sandbox }) => {
  const numTestFiles = 10
  const files: WriteEntry[] = []

  for (let i = 0; i < numTestFiles; i++) {
    const filePath = `writefiles_test_${i}.txt`

    files.push({
      path: filePath,
      data: `This is a test file ${i}.`,
    })
  }

  const infos = await sandbox.files.writeFiles(files)

  assert.isTrue(Array.isArray(infos))
  assert.equal(infos.length, files.length)

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const info = infos[i]

    assert.equal(info.name, path.basename(file.path))
    assert.equal(info.path, `/home/user/${file.path}`)
    assert.equal(info.type, 'file')

    const exists = await sandbox.files.exists(info.path)
    assert.isTrue(exists)

    const readContent = await sandbox.files.read(info.path)
    assert.equal(readContent, file.data)
  }

  if (isDebug) {
    for (const file of files) {
      await sandbox.files.remove(file.path)
    }
  }
})

sandboxTest('writeFiles with different data types', async ({ sandbox }) => {
  const textData = 'Text string data'
  const arrayBufferData = new TextEncoder().encode('ArrayBuffer data').buffer
  const blobData = new Blob(['Blob data'], { type: 'text/plain' })
  const streamContent = 'ReadableStream data'
  const encoder = new TextEncoder()
  const streamData = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(streamContent))
      controller.close()
    },
  })

  const files: WriteEntry[] = [
    { path: 'writefiles_text.txt', data: textData },
    { path: 'writefiles_arraybuffer.txt', data: arrayBufferData },
    { path: 'writefiles_blob.txt', data: blobData },
    { path: 'writefiles_stream.txt', data: streamData },
  ]

  const infos = await sandbox.files.writeFiles(files)

  assert.equal(infos.length, 4)

  // Verify text file
  const textContent = await sandbox.files.read('writefiles_text.txt')
  assert.equal(textContent, textData)

  // Verify ArrayBuffer file
  const arrayBufferContent = await sandbox.files.read(
    'writefiles_arraybuffer.txt'
  )
  assert.equal(arrayBufferContent, 'ArrayBuffer data')

  // Verify Blob file
  const blobContent = await sandbox.files.read('writefiles_blob.txt')
  assert.equal(blobContent, 'Blob data')

  // Verify ReadableStream file
  const streamFileContent = await sandbox.files.read('writefiles_stream.txt')
  assert.equal(streamFileContent, streamContent)

  if (isDebug) {
    for (const file of files) {
      await sandbox.files.remove(file.path)
    }
  }
})

sandboxTest('writeFiles creates parent directories', async ({ sandbox }) => {
  const files: WriteEntry[] = [
    {
      path: 'writefiles_nested_dir/nested/file1.txt',
      data: 'Content in nested directory',
    },
  ]

  const infos = await sandbox.files.writeFiles(files)

  assert.equal(infos.length, 1)
  assert.equal(
    infos[0].path,
    '/home/user/writefiles_nested_dir/nested/file1.txt'
  )

  const exists = await sandbox.files.exists(infos[0].path)
  assert.isTrue(exists)

  const content = await sandbox.files.read(infos[0].path)
  assert.equal(content, 'Content in nested directory')

  if (isDebug) {
    await sandbox.files.remove(files[0].path)
  }
})

sandboxTest('writeFiles overwrites existing files', async ({ sandbox }) => {
  const filename = 'writefiles_overwrite.txt'
  const initialContent = 'Initial content'
  const newContent = 'New content'

  // Write initial file
  await sandbox.files.writeFiles([{ path: filename, data: initialContent }])

  let readContent = await sandbox.files.read(filename)
  assert.equal(readContent, initialContent)

  // Overwrite with new content
  await sandbox.files.writeFiles([{ path: filename, data: newContent }])

  readContent = await sandbox.files.read(filename)
  assert.equal(readContent, newContent)

  if (isDebug) {
    await sandbox.files.remove(filename)
  }
})
