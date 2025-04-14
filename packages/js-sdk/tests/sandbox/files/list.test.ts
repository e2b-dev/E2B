import { assert, onTestFinished } from 'vitest'

import { sandboxTest } from '../../setup.js'

sandboxTest('list directory', async ({ sandbox }) => {
  const parentDirName = 'test_directory'

  await sandbox.files.makeDir(parentDirName)
  await sandbox.files.makeDir(`${parentDirName}/subdir1`)
  await sandbox.files.makeDir(`${parentDirName}/subdir2`)
  await sandbox.files.makeDir(`${parentDirName}/subdir1/subdir1_1`)
  await sandbox.files.makeDir(`${parentDirName}/subdir1/subdir1_2`)
  await sandbox.files.makeDir(`${parentDirName}/subdir2/subdir2_1`)
  await sandbox.files.makeDir(`${parentDirName}/subdir2/subdir2_2`)

  const testCases = [
    {
      name: 'explicit depth 0 (should default to 1)',
      depth: 0,
      expectedLen: 2,
      expectedFiles: ['subdir1', 'subdir2'],
    },
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
        'subdir1',
        'subdir1_1',
        'subdir1_2',
        'subdir2',
        'subdir2_1',
        'subdir2_2',
      ],
    },
    {
      name: 'explicit depth 3 (should be the same as depth 2)',
      depth: 3,
      expectedLen: 6,
      expectedFiles: [
        'subdir1',
        'subdir1_1',
        'subdir1_2',
        'subdir2',
        'subdir2_1',
        'subdir2_2',
      ],
    },
    {
      name: 'negative depth should error',
      depth: -1,
      expectedLen: 0,
      expectedFiles: [],
      expectError: 'invalid_argument',
    },
  ]

  for (const testCase of testCases) {
    if (testCase.expectError) {
      try {
        await sandbox.files.list(
          parentDirName,
          testCase.depth !== undefined ? { depth: testCase.depth } : undefined
        )
        assert.fail('Expected error but none was thrown')
      } catch (err) {
        assert.ok(
          err.message.includes(testCase.expectError),
          `expected error message to include "${testCase.expectError}"`
        )
        continue
      }
    } else {
      const files = await sandbox.files.list(
        parentDirName,
        testCase.depth !== undefined ? { depth: testCase.depth } : undefined
      )
      assert.equal(files.length, testCase.expectedLen)

      for (let i = 0; i < testCase.expectedFiles.length; i++) {
        assert.equal(files[i].name, testCase.expectedFiles[i])
      }
    }
  }

  onTestFinished(() => {
    sandbox.files.remove(parentDirName)
  })
})
