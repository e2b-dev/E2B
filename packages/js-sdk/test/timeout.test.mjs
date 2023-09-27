import {expect, test} from 'vitest'

import {Session} from '../src'
import {TimeoutError} from '../src/error.ts'


// TODO: Make it work on CI and re-enable!
test.skip('timeout session', async () => {
  await expect(
    Session.create({id: 'Nodejs', timeout: 10}),
  ).rejects.toThrow()
})

// TODO: Make it work on CI and re-enable!
test.skip('dont timeout session', async () => {
  const session = await Session.create({
    id: 'Nodejs',
    timeout: 10000,
  })
  await session.close()
})

// TODO: Make it work on CI and re-enable!
test.skip('timeout filesystem', async () => {
  const session = await Session.create({id: 'Nodejs'})
  await expect(
    session.filesystem.write('/home/test.txt', 'Hello World', {timeout: 10}),
  ).rejects.toThrow(TimeoutError)
  await expect(
    session.filesystem.read('/home/test.txt', {timeout: 10}),
  ).rejects.toThrow(TimeoutError)
  await expect(session.filesystem.list('/home', {timeout: 10})).rejects.toThrow(
    TimeoutError,
  )
  await expect(
    session.filesystem.makeDir('/home/test/', {timeout: 10}),
  ).rejects.toThrow(TimeoutError)
  await session.filesystem.write('/home/test.txt', 'Hello World')
  await expect(
    session.filesystem.remove('/home/test.txt', {timeout: 10}),
  ).rejects.toThrow(TimeoutError)
})

// TODO: Make it work on CI and re-enable!
test.skip('timeout process', async () => {
  const session = await Session.create({id: 'Nodejs'})
  await expect(
    session.process.start({cmd: "node -e 'setTimeout(() => {}, 10000)'", timeout: 10}),
  ).rejects.toThrow(TimeoutError)
  const process = await session.process.start({
    cmd: "while true; do echo 'Hello World'; sleep 1; done",
  })
  await expect(process.sendStdin('Hello World', {timeout: 10})).rejects.toThrow(
    TimeoutError,
  )
})

// TODO: Waiting for https://github.com/vitest-dev/vitest/issues/3119
test.skip(
  'timeout longer than cmd should not leak',
  () =>
    new Promise(async resolve => {
      const session = await Session.create({id: 'Nodejs'})
      const proc = await session.process.start({
        cmd: "node -e 'setTimeout(() => {}, 1000)'", // should take around 1 second
        onExit: () => {
          // TODO: Verify that process finished after successful cmd, and not after timeout
          resolve()
        },
        timeout: 10_000, // but we give it 10 seconds
      })
      await proc.finished
    }),
  {timeout: 12_000},
)
