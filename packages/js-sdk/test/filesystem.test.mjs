import { Session } from '../src'
import { expect, test } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

test('list files', async () => {
  const session = await Session.create({ id: 'Nodejs' })
  await session.filesystem.makeDir('/test/new')

  const ls = await session.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual(['new'])

  await session.close()
})

test('create file', async () => {
  const session = await Session.create({ id: 'Nodejs' })
  await session.filesystem.makeDir('/test')
  await session.filesystem.write('/test/test.txt', 'Hello World!')

  const ls = await session.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual(['test.txt'])

  await session.close()
})

test('read and write', async () => {
  const session = await Session.create({ id: 'Nodejs' })

  // String
  await session.filesystem.write('/tmp/test.txt', 'Hello World!')
  const content = await session.filesystem.read('/tmp/test.txt')
  expect(content).toEqual('Hello World!')

  // Binary file
  const binaryFile = fs.readFileSync(path.join(__dirname, '/assets/video.webm'))
  await session.filesystem.writeBytes('/tmp/video.webm', binaryFile)
  const binaryContent = await session.filesystem.readBytes('/tmp/video.webm')
  expect(binaryContent).toEqual(binaryFile)

  await session.close()
})

test('list delete files', async () => {
  const session = await Session.create({ id: 'Nodejs' })
  await session.filesystem.makeDir('/test/new')

  let ls = await session.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual(['new'])

  await session.filesystem.remove('/test/new')

  ls = await session.filesystem.list('/test')
  expect(ls.map(x => x.name)).toEqual([])

  await session.close()
})

test(
  'watch dir',
  async () => {
    const session = new Session({ id: 'Nodejs' })
    await session.open()
    await session.filesystem.write('/tmp/test.txt', 'Hello')

    const watcher = session.filesystem.watchDir('/tmp')

    const events = []
    watcher.addEventListener(ev => events.push(ev))

    await watcher.start()
    await session.filesystem.write('/tmp/test.txt', 'World!')
    await new Promise(r => setTimeout(r, 2500))
    await watcher.stop()

    expect(events.length).toBeGreaterThanOrEqual(1)

    const event = events[0]
    expect(event['operation']).toEqual('Write')
    expect(event['path']).toEqual('/tmp/test.txt')

    await session.close()
  },
  { timeout: 10_000 },
)
