import { Session } from '../src'
import { expect, test } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

test('upload and download file', async () => {
  const session = await Session.create({ id: 'Nodejs' })

  const localFile = fs.readFileSync(path.join(__dirname, '/assets/video.webm'))

  const uploadedFilePath = await session.uploadFile(localFile, 'video.webm')

  const ls = await session.filesystem.list('/home/user')
  expect(ls.map(x => x.name)).contains('video.webm')

  const downloadedFile = await session.downloadFile(uploadedFilePath, 'buffer')
  expect(localFile).toEqual(downloadedFile)

  await session.close()
})
