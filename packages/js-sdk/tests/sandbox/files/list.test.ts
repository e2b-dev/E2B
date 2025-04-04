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

  // explicit depth 0 (should default to 1)
  const files0 = await sandbox.files.list(parentDirName, { depth: 0 })
  console.log(files0)
  assert.equal(files0.length, 2)
  assert.equal(files0[0].name, 'subdir1')
  assert.equal(files0[1].name, 'subdir2')

  // default depth (1)
  const files = await sandbox.files.list(parentDirName)
  console.log(files)
  assert.equal(files.length, 2)
  assert.equal(files[0].name, 'subdir1')
  assert.equal(files[1].name, 'subdir2')

  // explicit depth 1
  const files1 = await sandbox.files.list(parentDirName, { depth: 1 })
  console.log(files1)
  assert.equal(files1.length, 2)
  assert.equal(files1[0].name, 'subdir1')
  assert.equal(files1[1].name, 'subdir2')

  // explicit depth 2
  const files2 = await sandbox.files.list(parentDirName, { depth: 2 })
  console.log(files2)
  assert.equal(files2.length, 6)
  assert.equal(files2[0].name, 'subdir1')
  assert.equal(files2[1].name, 'subdir1_1')
  assert.equal(files2[2].name, 'subdir1_2')
  assert.equal(files2[3].name, 'subdir2')
  assert.equal(files2[4].name, 'subdir2_1')
  assert.equal(files2[5].name, 'subdir2_2')

  // explicit depth 3 (should be the same as depth 2)
  const files3 = await sandbox.files.list(parentDirName, { depth: 3 })
  console.log(files3)
  assert.equal(files3.length, 6)
  assert.equal(files3[0].name, 'subdir1')
  assert.equal(files3[1].name, 'subdir1_1')
  assert.equal(files3[2].name, 'subdir1_2')
  assert.equal(files3[3].name, 'subdir2')
  assert.equal(files3[4].name, 'subdir2_1')
  assert.equal(files3[5].name, 'subdir2_2')

  onTestFinished(() => {
    sandbox.files.remove(parentDirName)
  })
})
