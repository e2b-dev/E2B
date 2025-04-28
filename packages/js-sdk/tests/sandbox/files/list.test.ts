import { assert, onTestFinished } from 'vitest'

import { sandboxTest } from '../../setup.js'

const parentDirName = 'test_directory'

sandboxTest('list directory', async ({ sandbox }) => {
  await sandbox.files.makeDir(parentDirName)
  await sandbox.files.makeDir(`${parentDirName}/subdir1`)
  await sandbox.files.makeDir(`${parentDirName}/subdir2`)
  await sandbox.files.makeDir(`${parentDirName}/subdir1/subdir1_1`)
  await sandbox.files.makeDir(`${parentDirName}/subdir1/subdir1_2`)
  await sandbox.files.makeDir(`${parentDirName}/subdir2/subdir2_1`)
  await sandbox.files.makeDir(`${parentDirName}/subdir2/subdir2_2`)

  const testCases = [
    {
      name: 'default depth (1)',
      depth: undefined,
      expectedLen: 2,
      expectedFiles: ['subdir1', 'subdir2'],
    },
    {
      name: 'explicit depth 1',
      depth: 1,
      expectedLen: 2,
      expectedFiles: ['subdir1', 'subdir2'],
    },
    {
      name: 'explicit depth 2',
      depth: 2,
      expectedLen: 6,
      expectedFiles: [
        `${parentDirName}/subdir1`,
        `${parentDirName}/subdir1/subdir1_1`,
        `${parentDirName}/subdir1/subdir1_2`,
        `${parentDirName}/subdir2`,
        `${parentDirName}/subdir2/subdir2_1`,
        `${parentDirName}/subdir2/subdir2_2`,
      ],
    },
    {
      name: 'explicit depth 3 (should be the same as depth 2)',
      depth: 3,
      expectedLen: 6,
      expectedFiles: [
        `${parentDirName}/subdir1`,
        `${parentDirName}/subdir1/subdir1_1`,
        `${parentDirName}/subdir1/subdir1_2`,
        `${parentDirName}/subdir2`,
        `${parentDirName}/subdir2/subdir2_1`,
        `${parentDirName}/subdir2/subdir2_2`,
      ],
    },
  ]

  for (const testCase of testCases) {
    const files = await sandbox.files.list(
      parentDirName,
      testCase.depth !== undefined ? { depth: testCase.depth } : undefined
    )
    assert.equal(files.length, testCase.expectedLen)

    for (let i = 0; i < testCase.expectedFiles.length; i++) {
      assert.equal(files[i].name, testCase.expectedFiles[i])
    }
  }

  onTestFinished(() => {
    sandbox.files.remove(parentDirName)
  })
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

  onTestFinished(() => {
    sandbox.files.remove(parentDirName)
  })
})
