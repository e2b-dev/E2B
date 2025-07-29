import { assert } from 'vitest'

import { sandboxTest } from '../../setup.js'

const parentDirName = 'test_directory'

sandboxTest('list directory', async ({ sandbox }) => {
  const homeDirName = '/home/user'
  await sandbox.files.makeDir(parentDirName)
  await sandbox.files.makeDir(`${parentDirName}/subdir1`)
  await sandbox.files.makeDir(`${parentDirName}/subdir2`)
  await sandbox.files.makeDir(`${parentDirName}/subdir1/subdir1_1`)
  await sandbox.files.makeDir(`${parentDirName}/subdir1/subdir1_2`)
  await sandbox.files.makeDir(`${parentDirName}/subdir2/subdir2_1`)
  await sandbox.files.makeDir(`${parentDirName}/subdir2/subdir2_2`)
  await sandbox.files.write(`${parentDirName}/file1.txt`, 'Hello, world!')

  const testCases = [
    {
      test_name: 'default depth (1)',
      depth: undefined,
      expectedLen: 3,
      expectedFileNames: ['file1.txt', 'subdir1', 'subdir2'],
      expectedFileTypes: ['file', 'dir', 'dir'],
      expectedFilePaths: [
        `${homeDirName}/${parentDirName}/file1.txt`,
        `${homeDirName}/${parentDirName}/subdir1`,
        `${homeDirName}/${parentDirName}/subdir2`,
      ],
    },
    {
      test_name: 'explicit depth 1',
      depth: 1,
      expectedLen: 3,
      expectedFileNames: ['file1.txt', 'subdir1', 'subdir2'],
      expectedFileTypes: ['file', 'dir', 'dir'],
      expectedFilePaths: [
        `${homeDirName}/${parentDirName}/file1.txt`,
        `${homeDirName}/${parentDirName}/subdir1`,
        `${homeDirName}/${parentDirName}/subdir2`,
      ],
    },
    {
      test_name: 'explicit depth 2',
      depth: 2,
      expectedLen: 7,
      expectedFileTypes: ['file', 'dir', 'dir', 'dir', 'dir', 'dir', 'dir'],
      expectedFileNames: [
        'file1.txt',
        'subdir1',
        'subdir1_1',
        'subdir1_2',
        'subdir2',
        'subdir2_1',
        'subdir2_2',
      ],
      expectedFilePaths: [
        `${homeDirName}/${parentDirName}/file1.txt`,
        `${homeDirName}/${parentDirName}/subdir1`,
        `${homeDirName}/${parentDirName}/subdir1/subdir1_1`,
        `${homeDirName}/${parentDirName}/subdir1/subdir1_2`,
        `${homeDirName}/${parentDirName}/subdir2`,
        `${homeDirName}/${parentDirName}/subdir2/subdir2_1`,
        `${homeDirName}/${parentDirName}/subdir2/subdir2_2`,
      ],
    },
    {
      test_name: 'explicit depth 3 (should be the same as depth 2)',
      depth: 3,
      expectedLen: 7,
      expectedFileTypes: ['file', 'dir', 'dir', 'dir', 'dir', 'dir', 'dir'],
      expectedFileNames: [
        'file1.txt',
        'subdir1',
        'subdir1_1',
        'subdir1_2',
        'subdir2',
        'subdir2_1',
        'subdir2_2',
      ],
      expectedFilePaths: [
        `${homeDirName}/${parentDirName}/file1.txt`,
        `${homeDirName}/${parentDirName}/subdir1`,
        `${homeDirName}/${parentDirName}/subdir1/subdir1_1`,
        `${homeDirName}/${parentDirName}/subdir1/subdir1_2`,
        `${homeDirName}/${parentDirName}/subdir2`,
        `${homeDirName}/${parentDirName}/subdir2/subdir2_1`,
        `${homeDirName}/${parentDirName}/subdir2/subdir2_2`,
      ],
    },
  ]

  for (const testCase of testCases) {
    const files = await sandbox.files.list(
      parentDirName,
      testCase.depth !== undefined ? { depth: testCase.depth } : undefined
    )
    assert.equal(files.length, testCase.expectedLen)

    for (let i = 0; i < testCase.expectedFilePaths.length; i++) {
      assert.equal(files[i].type, testCase.expectedFileTypes[i])
      assert.equal(files[i].name, testCase.expectedFileNames[i])
      assert.equal(files[i].path, testCase.expectedFilePaths[i])
    }
  }
})

sandboxTest('list directory with invalid depth', async ({ sandbox }) => {
  await sandbox.files.makeDir(parentDirName)

  try {
    await sandbox.files.list(parentDirName, { depth: -1 })
    assert.fail('Expected error but none was thrown')
  } catch (err) {
    const expectedErrorMessage = 'depth should be at least one'
    assert.ok(
      err.message.includes(expectedErrorMessage),
      `expected error message to include "${expectedErrorMessage}"`
    )
  }
})

sandboxTest('file entry details', async ({ sandbox }) => {
  const testDir = 'test-file-entry'
  const filePath = `${testDir}/test.txt`
  const content = 'Hello, World!'

  await sandbox.files.makeDir(testDir)
  await sandbox.files.write(filePath, content)

  const files = await sandbox.files.list(testDir, { depth: 1 })
  assert.equal(files.length, 1)

  const fileEntry = files[0]
  assert.equal(fileEntry.name, 'test.txt')
  assert.equal(fileEntry.path, `/home/user/${filePath}`)
  assert.equal(fileEntry.type, 'file')
  assert.equal(fileEntry.mode, 0o644)
  assert.equal(fileEntry.permissions, '-rw-r--r--')
  assert.equal(fileEntry.owner, 'user')
  assert.equal(fileEntry.group, 'user')
  assert.equal(fileEntry.size, content.length)
  assert.ok(fileEntry.modifiedTime)
  assert.isUndefined(fileEntry.symlinkTarget)
})

sandboxTest('directory entry details', async ({ sandbox }) => {
  const testDir = 'test-entry-info'
  const subDir = `${testDir}/subdir`

  await sandbox.files.makeDir(testDir)
  await sandbox.files.makeDir(subDir)

  const files = await sandbox.files.list(testDir, { depth: 1 })
  assert.equal(files.length, 1)

  const dirEntry = files[0]
  assert.equal(dirEntry.name, 'subdir')
  assert.equal(dirEntry.path, `/home/user/${subDir}`)
  assert.equal(dirEntry.type, 'dir')
  assert.equal(dirEntry.mode, 0o755)
  assert.equal(dirEntry.permissions, 'drwxr-xr-x')
  assert.equal(dirEntry.owner, 'user')
  assert.equal(dirEntry.group, 'user')
  assert.ok(dirEntry.modifiedTime)
})

sandboxTest('mixed entries (files and directories)', async ({ sandbox }) => {
  const testDir = 'test-mixed-entries'
  const subDir = `${testDir}/subdir`
  const filePath = `${testDir}/test.txt`
  const content = 'Hello, World!'

  await sandbox.files.makeDir(testDir)
  await sandbox.files.makeDir(subDir)
  await sandbox.files.write(filePath, content)

  const files = await sandbox.files.list(testDir, { depth: 1 })
  assert.equal(files.length, 2)

  // Create a map of entries by name for easier verification
  const entries = new Map(files.map((entry) => [entry.name, entry]))

  // Verify directory entry
  const dirEntry = entries.get('subdir')
  assert.ok(dirEntry)
  assert.equal(dirEntry!.path, `/home/user/${subDir}`)
  assert.equal(dirEntry!.type, 'dir')
  assert.equal(dirEntry!.mode, 0o755)
  assert.equal(dirEntry!.permissions, 'drwxr-xr-x')
  assert.equal(dirEntry!.owner, 'user')
  assert.equal(dirEntry!.group, 'user')
  assert.ok(dirEntry!.modifiedTime)

  // Verify file entry
  const fileEntry = entries.get('test.txt')
  assert.ok(fileEntry)
  assert.equal(fileEntry!.path, `/home/user/${filePath}`)
  assert.equal(fileEntry!.type, 'file')
  assert.equal(fileEntry!.mode, 0o644)
  assert.equal(fileEntry!.permissions, '-rw-r--r--')
  assert.equal(fileEntry!.owner, 'user')
  assert.equal(fileEntry!.group, 'user')
  assert.equal(fileEntry!.size, content.length)
  assert.ok(fileEntry!.modifiedTime)
})
