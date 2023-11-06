import { Sandbox } from '../src'
import { expect, test } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { id } from './setup.mjs'

test('upload and download file', async () => {
  const sandbox = await Sandbox.create({ id })

  const localFile = fs.readFileSync(path.join(__dirname, '/assets/video.webm'))

  const uploadedFilePath = await sandbox.uploadFile(localFile, 'video.webm')

  const ls = await sandbox.filesystem.list('/home/user')
  expect(ls.map(x => x.name)).contains('video.webm')

  const downloadedFile = await sandbox.downloadFile(uploadedFilePath, 'buffer')
  expect(localFile).toEqual(downloadedFile)

  await sandbox.close()
})
