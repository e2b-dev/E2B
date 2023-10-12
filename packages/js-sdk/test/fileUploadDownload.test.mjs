import { Session } from '../src'
import { expect, test } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

test('upload and download file', async () => {
  const session = await Session.create({ id: 'Nodejs' })

  const localFile = fs.readFileSync(path.join(__dirname, '/assets/video.webm'))

  const uploadedFilePath = await session.uploadFile(localFile, 'video.webm')

  const response = await session.downloadFile(uploadedFilePath)
  const downloadedFile = await response.buffer()

  expect(localFile).toEqual(downloadedFile)

  await session.close()
})
