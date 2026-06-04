import { assert } from 'vitest'

import { WriteEntry } from '../../../src/sandbox/filesystem'
import { isDebug, sandboxTest } from '../../setup.js'

sandboxTest('write file with metadata', async ({ sandbox }) => {
  const filename = 'test_metadata.txt'
  const content = 'This is a test file with metadata.'
  const metadata = { author: 'mish', purpose: 'upload' }

  const info = await sandbox.files.write(filename, content, { metadata })
  assert.isFalse(Array.isArray(info))
  assert.deepEqual(info.metadata, metadata)

  // Metadata is persisted and surfaced on subsequent reads.
  const stat = await sandbox.files.getInfo(filename)
  assert.deepEqual(stat.metadata, metadata)

  if (isDebug) {
    await sandbox.files.remove(filename)
  }
})

sandboxTest(
  'write file with metadata using octet-stream',
  async ({ sandbox }) => {
    const filename = 'test_metadata_octet.txt'
    const content = 'This is a test file with metadata.'
    const metadata = { author: 'mish', purpose: 'upload' }

    const info = await sandbox.files.write(filename, content, {
      metadata,
      useOctetStream: true,
    })
    assert.deepEqual(info.metadata, metadata)

    const stat = await sandbox.files.getInfo(filename)
    assert.deepEqual(stat.metadata, metadata)

    if (isDebug) {
      await sandbox.files.remove(filename)
    }
  }
)

sandboxTest('write file without metadata', async ({ sandbox }) => {
  const filename = 'test_no_metadata.txt'

  const info = await sandbox.files.write(filename, 'no metadata here')
  assert.isUndefined(info.metadata)

  const stat = await sandbox.files.getInfo(filename)
  assert.isUndefined(stat.metadata)

  if (isDebug) {
    await sandbox.files.remove(filename)
  }
})

sandboxTest(
  'writeFiles applies metadata to every file',
  async ({ sandbox }) => {
    // The same metadata is applied to every file in the upload.
    const metadata = { source: 'test-suite' }
    const files: WriteEntry[] = [
      { path: 'metadata_multi_1.txt', data: 'File 1' },
      { path: 'metadata_multi_2.txt', data: 'File 2' },
    ]

    const infos = await sandbox.files.writeFiles(files, { metadata })
    assert.equal(infos.length, files.length)

    for (const info of infos) {
      assert.deepEqual(info.metadata, metadata)

      const stat = await sandbox.files.getInfo(info.path)
      assert.deepEqual(stat.metadata, metadata)
    }

    if (isDebug) {
      for (const file of files) {
        await sandbox.files.remove(file.path)
      }
    }
  }
)

sandboxTest('metadata is surfaced when listing', async ({ sandbox }) => {
  const dirname = 'metadata_list_dir'
  const filename = 'listed.txt'
  const metadata = { tag: 'listed' }

  await sandbox.files.makeDir(dirname)
  await sandbox.files.write(`${dirname}/${filename}`, 'content', { metadata })

  const entries = await sandbox.files.list(dirname)
  const entry = entries.find((e) => e.name === filename)
  assert.isDefined(entry)
  assert.deepEqual(entry?.metadata, metadata)

  if (isDebug) {
    await sandbox.files.remove(dirname)
  }
})

sandboxTest('metadata is surfaced after rename', async ({ sandbox }) => {
  const oldPath = 'metadata_rename_old.txt'
  const newPath = 'metadata_rename_new.txt'
  const metadata = { stage: 'renamed' }

  await sandbox.files.write(oldPath, 'content', { metadata })
  const info = await sandbox.files.rename(oldPath, newPath)
  assert.deepEqual(info.metadata, metadata)

  if (isDebug) {
    await sandbox.files.remove(newPath)
  }
})

sandboxTest('overwriting a file clears stale metadata', async ({ sandbox }) => {
  const filename = 'metadata_overwrite.txt'

  await sandbox.files.write(filename, 'first', {
    metadata: { author: 'mish' },
  })

  // Overwriting without metadata removes the previously stored metadata.
  const info = await sandbox.files.write(filename, 'second')
  assert.isUndefined(info.metadata)

  const stat = await sandbox.files.getInfo(filename)
  assert.isUndefined(stat.metadata)

  if (isDebug) {
    await sandbox.files.remove(filename)
  }
})

sandboxTest(
  'metadata set via xattrs is surfaced in getInfo',
  async ({ sandbox }) => {
    const filename = 'metadata_xattr.txt'
    await sandbox.files.write(filename, 'content')

    const { stdout: filePath } = await sandbox.commands.run(
      `realpath ${filename}`
    )

    // Set an xattr directly in the `user.e2b.` namespace; it should surface as
    // metadata (with the namespace prefix stripped) when reading the file info.
    await sandbox.commands.run(
      `setfattr -n user.e2b.author -v mish ${filePath.trim()}`
    )

    const info = await sandbox.files.getInfo(filename)
    assert.deepEqual(info.metadata, { author: 'mish' })

    if (isDebug) {
      await sandbox.files.remove(filename)
    }
  }
)
