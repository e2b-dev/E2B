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
