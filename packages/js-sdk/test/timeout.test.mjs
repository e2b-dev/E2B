import { expect, test } from 'vitest'

import { Session } from '../src'
import { TimeoutError } from '../src/error.ts'

const E2B_API_KEY = process.env.E2B_API_KEY

test('timeout session', async () => {
  await expect(
    Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY, timeout: 10 }),
  ).rejects.toThrow()
})

test('dont timeout session', async () => {
  const session = await Session.create({
    id: 'Nodejs',
    apiKey: E2B_API_KEY,
    timeout: 10000,
  })
  await session.close()
})

test('timeout filesystem', async () => {
  const session = await Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY })
  await expect(
    session.filesystem.write('/home/test.txt', 'Hello World', { timeout: 10 }),
  ).rejects.toThrow(TimeoutError)
  await expect(
    session.filesystem.read('/home/test.txt', { timeout: 10 }),
  ).rejects.toThrow(TimeoutError)
  await expect(session.filesystem.list('/home', { timeout: 10 })).rejects.toThrow(
    TimeoutError,
  )
  await expect(
    session.filesystem.makeDir('/home/test/', { timeout: 10 }),
  ).rejects.toThrow(TimeoutError)
  await session.filesystem.write('/home/test.txt', 'Hello World')
  await expect(
    session.filesystem.remove('/home/test.txt', { timeout: 10 }),
  ).rejects.toThrow(TimeoutError)
})

test('timeout process', async () => {
  const session = await Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY })
  await expect(
    session.process.start({ cmd: "node -e 'setTimeout(() => {}, 10000)'", timeout: 10 }),
  ).rejects.toThrow(TimeoutError)
  const process = await session.process.start({
    cmd: "while true; do echo 'Hello World'; sleep 1; done",
  })
  await expect(process.sendStdin('Hello World', { timeout: 10 })).rejects.toThrow(
    TimeoutError,
  )
})
