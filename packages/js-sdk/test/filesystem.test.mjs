import { Sandbox } from '../src'
import { expect, test } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { id } from './setup.mjs'

test('list files', async () => {
  const sandbox = await Sandbox.create({ id })
  await sandbox.filesystem.makeDir('/test/new')

  const ls = await sandbox.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual(['new'])

  await sandbox.close()
})

test('create file', async () => {
  const sandbox = await Sandbox.create({ id })
  await sandbox.filesystem.makeDir('/test')
  await sandbox.filesystem.write('/test/test.txt', 'Hello World!')

  const ls = await sandbox.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual(['test.txt'])

  await sandbox.close()
})

test('read and write', async () => {
  const sandbox = await Sandbox.create({ id })

  // String
  await sandbox.filesystem.write('/tmp/test.txt', 'Hello World!')
  const content = await sandbox.filesystem.read('/tmp/test.txt')
  expect(content).toEqual('Hello World!')

  // Binary file
  const binaryFile = fs.readFileSync(path.join(__dirname, '/assets/video.webm'))
  await sandbox.filesystem.writeBytes('/tmp/video.webm', binaryFile)
  const binaryContent = await sandbox.filesystem.readBytes('/tmp/video.webm')
  expect(binaryContent).toEqual(binaryFile)

  await sandbox.close()
})

test('list delete files', async () => {
  const sandbox = await Sandbox.create({ id })
  await sandbox.filesystem.makeDir('/test/new')

  let ls = await sandbox.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual(['new'])

  await sandbox.filesystem.remove('/test/new')

  ls = await sandbox.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual([])

  await sandbox.close()
})

test('watch dir', async () => {
  const sandbox = await Sandbox.create({ id })
  await sandbox.filesystem.write('/tmp/test.txt', 'Hello')

  const watcher = sandbox.filesystem.watchDir('/tmp')

  const events = []
  watcher.addEventListener(ev => events.push(ev))

  await watcher.start()
  await sandbox.filesystem.write('/tmp/test.txt', 'World!')
  await new Promise(r => setTimeout(r, 2500))
  await watcher.stop()

  expect(events.length).toBeGreaterThanOrEqual(1)

  const event = events[0]
  expect(event['operation']).toEqual('Write')
  expect(event['path']).toEqual('/tmp/test.txt')

  await sandbox.close()
})
