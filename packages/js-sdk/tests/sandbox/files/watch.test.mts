import { assert, expect } from 'vitest'

import { sandboxTest } from '../../setup.mjs'
import { FilesystemEventType, NotFoundError } from '../../../src'

sandboxTest('watch directory changes', async ({ sandbox }) => {
  const dirname = 'test_watch_dir'
  const filename = 'test_watch.txt'
  const content = 'This file will be watched.'
  const newContent = 'This file has been modified.'

  await sandbox.files.makeDir(dirname)
  await sandbox.files.write(`${dirname}/${filename}`, content)

  let eventTriggered = false
  const handle = await sandbox.files.watch(dirname, async (event) => {
    if (event.type === FilesystemEventType.WRITE && event.name === filename) {
      eventTriggered = true
    }
  })

  await sandbox.files.write(`${dirname}/${filename}`, newContent)
  await new Promise(resolve => setTimeout(resolve, 1000)) // wait for the event to be triggered

  assert.isTrue(eventTriggered)

  await handle.close()
})

sandboxTest('watch non-existing directory', async ({ sandbox }) => {
  const dirname = 'non_existing_watch_dir'

  await expect(sandbox.files.watch(dirname, () => { })).rejects.toThrowError(NotFoundError)
})
