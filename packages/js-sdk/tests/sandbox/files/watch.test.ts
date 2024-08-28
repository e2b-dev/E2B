import { assert, expect, onTestFinished } from 'vitest'

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

  onTestFinished(async () =>  {
    await sandbox.files.remove('/'+parentDir)
  })

  let trigger1: () => void
  let trigger2: () => void
  let trigger3: () => void

  const eventPromise1 = new Promise<void>((resolve) => {
    trigger1 = resolve
  })

  const eventPromise2 = new Promise<void>((resolve) => {
    trigger2 = resolve
  })

  const eventPromise3 = new Promise<void>((resolve) => {
    trigger3 = resolve
  })

  const handle = await sandbox.files.watch('/', async (event) => {
    assert.strictEqual(event.type, FilesystemEventType.CREATE)
    // watch parent dir creation
    if (event.name === `/${parentDir}`) trigger1()
    // watch child dir creation
    if (event.name === `/${parentDir}/${childDir}`) trigger2()
    // watch nested file creation
    if (event.name === filePath) trigger3()
  }, { eventTypes: new Set([FilesystemEventType.CREATE])})

  await sandbox.files.makeDir('/' + parentDir)
  await sandbox.files.makeDir(`/${parentDir}/${childDir}`)
  await sandbox.files.write(filePath, content)

  await Promise.all([eventPromise1, eventPromise2, eventPromise3])

  await handle.close()
})
