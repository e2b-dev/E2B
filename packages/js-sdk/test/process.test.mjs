import { Sandbox } from '../src'
import { expect, test, vi } from 'vitest'

import { id } from './setup.mjs'

test('process on stdout/stderr', async () => {
  const sandbox = await Sandbox.create({ id })

  const stdout = []
  const stderr = []

  const process = await sandbox.process.start({
    cmd: 'pwd',
    onStdout: data => stdout.push(data),
    onStderr: data => stderr.push(data),
    cwd: '/tmp'
  })

  const output = await process.finished

  expect(output.error).toEqual(false)
  expect(output.stdout).toEqual('/tmp')
  expect(output.stderr).toEqual('')
  expect(stdout.map(message => message.line)).toEqual(['/tmp'])
  expect(stderr).toEqual([])
  expect(process.output.exitCode).toEqual(0)
  await sandbox.close()
})

test('process expected stdout', async () => {
  // TODO: Implement this once we fix envd stdout/stderr race condition
})

test('process expected stderr', async () => {
  // TODO: Implement this once we fix envd stdout/stderr race condition
})

test('process on exit', async () => {
  const sandbox = await Sandbox.create({ id })

  const onExit = vi.fn(() => {
  })

  const process = await sandbox.process.start({
    cmd: 'pwd',
    onExit
  })

  await process.wait()
  expect(onExit).toHaveBeenCalled()

  await sandbox.close()
})

test('process send stdin', async () => {
  const sandbox = await Sandbox.create({ id })

  const process = await sandbox.process.start({
    cmd: 'read -r line; echo "$line"',
    cwd: '/code'
  })
  await process.sendStdin('ping\n')
  await process.wait()

  expect(process.output.stdout).toEqual('ping')
  // TODO: Parity with Python SDK
  // expect(process.output.messages.length).toEqual(1)
  // const message = process.output_messages[0]
  // assert.equal(message.line, "ping")
  // assert.equal(message.error, false)

  await sandbox.close()
}, 10000)

test('test default on exit', async () => {
  const onExit = vi.fn(() => {
  })

  const sandbox = await Sandbox.create({ id, onExit })
  const processOverride = await sandbox.process.start({
    cmd: 'pwd',
    onExit: console.log
  })
  await processOverride.finished
  expect(onExit).not.toHaveBeenCalled()

  const process = await sandbox.process.start({
    cmd: 'pwd'
  })

  await process.wait()
  expect(onExit).toHaveBeenCalled()

  await sandbox.close()
})

test('test default on stdout/stderr', async () => {
  const onStdout = vi.fn(() => {
  })
  const onStderr = vi.fn(() => {
  })

  const sandbox = await Sandbox.create({ id, onStdout, onStderr })

  const processOverride = await sandbox.process.start({
    cmd: 'node -e "console.log(\'Hello\'); throw new Error(\'Ooopsie -_-\')"',
    onStdout: () => {
    },
    onStderr: () => {
    }
  })

  await processOverride.wait()
  expect(onStdout).not.toHaveBeenCalled()
  expect(onStderr).not.toHaveBeenCalled()

  const process = await sandbox.process.start({
    cmd: 'node -e "console.log(\'Hello\'); throw new Error(\'Ooopsie -_-\')"'
  })

  await process.wait()
  expect(onStdout).toHaveBeenCalledOnce()
  expect(onStderr).toHaveBeenCalled()
  expect(process.output.exitCode).toEqual(1)

  await sandbox.close()
}, 10000)



test('test process start and wait', async () => {
  const sandbox = await Sandbox.create(id)

  const output = await sandbox.process.startAndWait('node -e "console.log(\'Hello\');"')

  expect(output.exitCode).toEqual(0)

  await sandbox.close()
})
