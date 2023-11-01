import { expect, test } from 'vitest'

import { Sandbox } from '../src'
import { TimeoutError } from '../src/error.ts'

import { id } from './setup.mjs'

// TODO: Make it work on CI and re-enable!
test.skip('timeout sandbox', async () => {
  await expect(Sandbox.create({ id, timeout: 10 })).rejects.toThrow()
})

// TODO: Make it work on CI and re-enable!
test.skip('dont timeout sandbox', async () => {
  const sandbox = await Sandbox.create({
    id,
    timeout: 10000
  })
  await sandbox.close()
})

// TODO: Make it work on CI and re-enable!
test.skip('timeout filesystem', async () => {
  const sandbox = await Sandbox.create({ id })
  await expect(
    sandbox.filesystem.write('/home/test.txt', 'Hello World', { timeout: 10 })
  ).rejects.toThrow(TimeoutError)
  await expect(
    sandbox.filesystem.read('/home/test.txt', { timeout: 10 })
  ).rejects.toThrow(TimeoutError)
  await expect(sandbox.filesystem.list('/home', { timeout: 10 })).rejects.toThrow(
    TimeoutError
  )
  await expect(
    sandbox.filesystem.makeDir('/home/test/', { timeout: 10 })
  ).rejects.toThrow(TimeoutError)
  await sandbox.filesystem.write('/home/test.txt', 'Hello World')
  await expect(
    sandbox.filesystem.remove('/home/test.txt', { timeout: 10 })
  ).rejects.toThrow(TimeoutError)
})

// TODO: Make it work on CI and re-enable!
test.skip('timeout process', async () => {
  const sandbox = await Sandbox.create({ id: 'Nodejs' })
  await expect(
    sandbox.process.start({ cmd: 'node -e \'setTimeout(() => {}, 10000)\'', timeout: 10 })
  ).rejects.toThrow(TimeoutError)
  const process = await sandbox.process.start({
    cmd: 'while true; do echo \'Hello World\'; sleep 1; done'
  })
  await expect(process.sendStdin('Hello World', { timeout: 10 })).rejects.toThrow(
    TimeoutError
  )
})

// TODO: Waiting for https://github.com/vitest-dev/vitest/issues/3119
test.skip('timeout longer than cmd should not leak', () =>
  new Promise(async resolve => {
    const sandbox = await Sandbox.create({ id: 'Nodejs' })
    const proc = await sandbox.process.start({
      cmd: 'node -e \'setTimeout(() => {}, 1000)\'', // should take around 1 second
      onExit: () => {
        // TODO: Verify that process finished after successful cmd, and not after timeout
        resolve()
      },
      timeout: 10_000 // but we give it 10 seconds
    })
    await proc.finished
  }))
