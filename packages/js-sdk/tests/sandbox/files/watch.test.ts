import { expect, onTestFinished } from 'vitest'

import { FilesystemEventType, NotFoundError } from '../../../src'
import { sandboxTest } from '../../setup.js'

sandboxTest('watch directory changes', async ({ sandbox }) => {
  const dirname = 'test_watch_dir'
  const filename = 'test_watch.txt'
  const content = 'This file will be watched.'
  const newContent = 'This file has been modified.'

  await sandbox.files.makeDir(dirname)
  await sandbox.files.write(`${dirname}/${filename}`, content)

  let trigger: () => void

  const eventPromise = new Promise<void>(resolve => {
    trigger = resolve
  })


  const handle = await sandbox.files.watch(dirname, async (event) => {
    if (event.type === FilesystemEventType.WRITE && event.name === `/home/user/${dirname}/${filename}`) {
      trigger()
    }
  })

  await sandbox.files.write(`${dirname}/${filename}`, newContent)

  await eventPromise

  await handle.close()
})

sandboxTest('watch non-existing directory', async ({ sandbox }) => {
  const dirname = 'non_existing_watch_dir'

  await expect(sandbox.files.watch(dirname, () => { })).rejects.toThrowError(NotFoundError)
})

sandboxTest('watch recursive directory changes', async ({ sandbox }) => {
  const parentDir = 'a'
  const childDir = 'b'
  const fileName = 'test_watch.txt'
  const filePath = `/${parentDir}/${childDir}/${fileName}`
  const content = 'This file will be watched.'
  onTestFinished(() =>  {
    sandbox.files.remove('/'+parentDir)
  })

  let trigger1: () => void
  let trigger2: () => void

  const eventPromise1 = new Promise<void>((resolve) => {
    trigger1 = resolve
  })

  const eventPromise2 = new Promise<void>((resolve) => {
    trigger2 = resolve
  })

  // watch nested dir creation
  const handle1 = await sandbox.files.watch('/', async (event) => {
    if (event.type === FilesystemEventType.CREATE && event.name === `/${parentDir}/${childDir}`) {
      trigger1()
    }
  })

  // watch nested file creation
  const handle2 = await sandbox.files.watch('/', async (event) => {
    if (event.type === FilesystemEventType.CREATE && event.name === filePath) {
      trigger2()
    }
  })

  await sandbox.files.makeDir('/a')
  await sandbox.files.makeDir('/a/b')
  await sandbox.files.write(filePath, content)

  await eventPromise1
  await eventPromise2

  await handle1.close()
  await handle2.close()
})
