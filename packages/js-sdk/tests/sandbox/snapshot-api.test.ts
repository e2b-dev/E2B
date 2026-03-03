import { assert } from 'vitest'

import { sandboxTest, isDebug } from '../setup.js'
import { Sandbox } from '../../src'

sandboxTest.skipIf(isDebug)(
  'create a snapshot from sandbox',
  async ({ sandbox }) => {
    // Write a file to the sandbox
    await sandbox.files.write('/home/user/test.txt', 'snapshot test content')

    // Create a snapshot
    const snapshot = await sandbox.createSnapshot()

    assert.isString(snapshot.snapshotId)
    assert.isTrue(snapshot.snapshotId.length > 0)

    // Cleanup
    await Sandbox.deleteSnapshot(snapshot.snapshotId)
  }
)

sandboxTest.skipIf(isDebug)(
  'create sandbox from snapshot',
  async ({ sandbox, sandboxTestId }) => {
    const testContent = 'content from original sandbox'

    // Write a file to the sandbox
    await sandbox.files.write('/home/user/test.txt', testContent)

    // Create a snapshot
    const snapshot = await sandbox.createSnapshot()

    try {
      // Create a new sandbox from the snapshot
      const newSandbox = await Sandbox.create(snapshot.snapshotId, {
        metadata: { sandboxTestId: `${sandboxTestId}-from-snapshot` },
      })

      try {
        // Verify the file exists in the new sandbox
        const content = await newSandbox.files.read('/home/user/test.txt')
        assert.equal(content, testContent)
      } finally {
        await newSandbox.kill()
      }
    } finally {
      await Sandbox.deleteSnapshot(snapshot.snapshotId)
    }
  }
)

sandboxTest.skipIf(isDebug)(
  'create multiple sandboxes from same snapshot',
  async ({ sandbox, sandboxTestId }) => {
    const testContent = 'shared snapshot content'

    await sandbox.files.write('/home/user/shared.txt', testContent)

    const snapshot = await sandbox.createSnapshot()

    try {
      // Create two sandboxes from the same snapshot
      const sandbox1 = await Sandbox.create(snapshot.snapshotId, {
        metadata: { sandboxTestId: `${sandboxTestId}-branch-1` },
      })
      const sandbox2 = await Sandbox.create(snapshot.snapshotId, {
        metadata: { sandboxTestId: `${sandboxTestId}-branch-2` },
      })

      try {
        // Both should have the same initial content
        const content1 = await sandbox1.files.read('/home/user/shared.txt')
        const content2 = await sandbox2.files.read('/home/user/shared.txt')

        assert.equal(content1, testContent)
        assert.equal(content2, testContent)

        // Modify one sandbox - should not affect the other
        await sandbox1.files.write(
          '/home/user/shared.txt',
          'modified in sandbox1'
        )

        const modifiedContent = await sandbox1.files.read(
          '/home/user/shared.txt'
        )
        const unchangedContent = await sandbox2.files.read(
          '/home/user/shared.txt'
        )

        assert.equal(modifiedContent, 'modified in sandbox1')
        assert.equal(unchangedContent, testContent)
      } finally {
        await sandbox1.kill()
        await sandbox2.kill()
      }
    } finally {
      await Sandbox.deleteSnapshot(snapshot.snapshotId)
    }
  }
)

sandboxTest.skipIf(isDebug)('list snapshots', async ({ sandbox }) => {
  // Create a snapshot
  const snapshot = await sandbox.createSnapshot()

  try {
    // List all snapshots
    const paginator = Sandbox.listSnapshots()
    assert.isTrue(paginator.hasNext)

    const snapshots = await paginator.nextItems()
    assert.isArray(snapshots)

    // Find our snapshot in the list
    const found = snapshots.find((s) => s.snapshotId === snapshot.snapshotId)
    assert.isDefined(found)
  } finally {
    await Sandbox.deleteSnapshot(snapshot.snapshotId)
  }
})

sandboxTest.skipIf(isDebug)(
  'list snapshots for specific sandbox',
  async ({ sandbox }) => {
    // Create a snapshot
    const snapshot = await sandbox.createSnapshot()

    try {
      // List snapshots for this sandbox using instance method
      const paginator = sandbox.listSnapshots()
      const snapshots = await paginator.nextItems()

      // Should find our snapshot
      const found = snapshots.find((s) => s.snapshotId === snapshot.snapshotId)
      assert.isDefined(found)
    } finally {
      await Sandbox.deleteSnapshot(snapshot.snapshotId)
    }
  }
)

sandboxTest.skipIf(isDebug)('delete snapshot', async ({ sandbox }) => {
  const snapshot = await sandbox.createSnapshot()

  // Delete should succeed
  const deleted = await Sandbox.deleteSnapshot(snapshot.snapshotId)
  assert.isTrue(deleted)

  // Second delete should return false (not found)
  const deletedAgain = await Sandbox.deleteSnapshot(snapshot.snapshotId)
  assert.isFalse(deletedAgain)
})

sandboxTest.skipIf(isDebug)(
  'snapshot preserves file system state',
  async ({ sandbox, sandboxTestId }) => {
    const appDir = '/home/user/app'
    const configPath = `${appDir}/config.json`
    const configContent = '{"env": "test"}'
    const dataPath = `${appDir}/data.txt`
    const dataContent = 'important data'

    await sandbox.files.makeDir(appDir)
    await sandbox.files.write(configPath, configContent)
    await sandbox.files.write(dataPath, dataContent)

    const snapshot = await sandbox.createSnapshot()

    try {
      const newSandbox = await Sandbox.create(snapshot.snapshotId, {
        metadata: { sandboxTestId: `${sandboxTestId}-fs-test` },
      })

      try {
        // Verify directory exists
        const dirExists = await newSandbox.files.exists(appDir)
        assert.isTrue(dirExists)

        // Verify files exist with correct content
        const config = await newSandbox.files.read(configPath)
        const data = await newSandbox.files.read(dataPath)

        assert.equal(config, configContent)
        assert.equal(data, dataContent)
      } finally {
        await newSandbox.kill()
      }
    } finally {
      await Sandbox.deleteSnapshot(snapshot.snapshotId)
    }
  }
)
