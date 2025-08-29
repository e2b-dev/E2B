import { expect, onTestFinished } from 'vitest'

import { isDebug, sandboxTest } from '../../setup.js'
import { FilesystemEventType, NotFoundError, SandboxError } from '../../../src'

sandboxTest('watch directory changes', async ({ sandbox }) => {
  const dirname = 'test_watch_dir'
  const filename = 'test_watch.txt'
  const content = 'This file will be watched.'
  const newContent = 'This file has been modified.'

  await sandbox.files.makeDir(dirname)
  await sandbox.files.write(`${dirname}/${filename}`, content)

  let trigger: () => void

  const eventPromise = new Promise<void>((resolve) => {
    trigger = resolve
  })

  const handle = await sandbox.files.watchDir(dirname, async (event) => {
    if (event.type === FilesystemEventType.WRITE && event.name === filename) {
      trigger()
    }
  })

  await sandbox.files.write(`${dirname}/${filename}`, newContent)

  await eventPromise

  await handle.stop()
})

sandboxTest('watch recursive directory changes', async ({ sandbox }) => {
  const dirname = 'test_recursive_watch_dir'
  const nestedDirname = 'test_nested_watch_dir'
  const filename = 'test_watch.txt'
  const content = 'This file will be watched.'
  const newContent = 'This file has been modified.'

  await sandbox.files.makeDir(`${dirname}/${nestedDirname}`)
  if (isDebug) {
    onTestFinished(() => sandbox.files.remove(dirname))
  }

  await sandbox.files.write(`${dirname}/${nestedDirname}/${filename}`, content)

  let trigger: () => void

  const eventPromise = new Promise<void>((resolve) => {
    trigger = resolve
  })

  const expectedFileName = `${nestedDirname}/${filename}`
  const handle = await sandbox.files.watchDir(
    dirname,
    async (event) => {
      if (
        event.type === FilesystemEventType.WRITE &&
        event.name === expectedFileName
      ) {
        trigger()
      }
    },
    {
      recursive: true,
    }
  )

  await sandbox.files.write(
    `${dirname}/${nestedDirname}/${filename}`,
    newContent
  )

  await eventPromise

  await handle.stop()
})

sandboxTest(
  'watch recursive directory after nested folder addition',
  async ({ sandbox }) => {
    const dirname = 'test_recursive_watch_dir_add'
    const nestedDirname = 'test_nested_watch_dir'
    const filename = 'test_watch.txt'
    const content = 'This file will be watched.'

    await sandbox.files.makeDir(dirname)
    if (isDebug) {
      onTestFinished(() => sandbox.files.remove(dirname))
    }

    let triggerFile: () => void
    let triggerFolder: () => void

    const eventFilePromise = new Promise<void>((resolve) => {
      triggerFile = resolve
    })
    const eventFolderPromise = new Promise<void>((resolve) => {
      triggerFolder = resolve
    })

    const expectedFileName = `${nestedDirname}/${filename}`
    const handle = await sandbox.files.watchDir(
      dirname,
      async (event) => {
        if (
          event.type === FilesystemEventType.WRITE &&
          event.name === expectedFileName
        ) {
          triggerFile()
        } else if (
          event.type === FilesystemEventType.CREATE &&
          event.name === nestedDirname
        ) {
          triggerFolder()
        }
      },
      {
        recursive: true,
      }
    )

    await sandbox.files.makeDir(`${dirname}/${nestedDirname}`)
    await eventFolderPromise

    await sandbox.files.write(
      `${dirname}/${nestedDirname}/${filename}`,
      content
    )
    await eventFilePromise

    await handle.stop()
  }
)

sandboxTest('watch non-existing directory', async ({ sandbox }) => {
  const dirname = 'non_existing_watch_dir'

  await expect(sandbox.files.watchDir(dirname, () => {})).rejects.toThrowError(
    NotFoundError
  )
})

sandboxTest('watch file', async ({ sandbox }) => {
  const filename = 'test_watch.txt'
  const content = 'This file will be watched.'
  await sandbox.files.write(filename, content)

  await expect(sandbox.files.watchDir(filename, () => {})).rejects.toThrowError(
    SandboxError
  )
})
