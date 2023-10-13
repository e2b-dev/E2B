import { Session } from '../src'
import { expect, test, vi } from 'vitest'

test('process on stdout/stderr', async () => {
  const session = await Session.create({ id: 'Nodejs' })

  const stdout = []
  const stderr = []

  const process = await session.process.start({
    cmd: 'pwd',
    onStdout: data => stdout.push(data),
    onStderr: data => stderr.push(data),
    cwd: '/tmp',
  })

  const output = await process.finished

  expect(output.error).toEqual(false)
  expect(output.stdout).toEqual('/tmp')
  expect(output.stderr).toEqual('')
  expect(stdout.map(message => message.line)).toEqual(['/tmp'])
  expect(stderr).toEqual([])
  expect(process.output.exitCode).toEqual(0)
  await session.close()
})

test('process expected stdout', async () => {
  // TODO: Implement this once we fix envd stdout/stderr race condition
})

test('process expected stderr', async () => {
  // TODO: Implement this once we fix envd stdout/stderr race condition
})

test('process on exit', async () => {
  const session = await Session.create({ id: 'Nodejs' })

  const onExit = vi.fn(() => {})

  const process = await session.process.start({
    cmd: 'pwd',
    onExit,
  })

  await process.finished
  expect(onExit).toHaveBeenCalled()

  await session.close()
})

test('process send stdin', async () => {
  const session = await Session.create({ id: 'Nodejs' })

  const process = await session.process.start({
    cmd: 'read -r line; echo "$line"',
    cwd: '/code',
  })
  await process.sendStdin('ping\n')
  await process.finished

  expect(process.output.stdout).toEqual('ping')
  // TODO: Parity with Python SDK
  // expect(process.output.messages.length).toEqual(1)
  // const message = process.output_messages[0]
  // assert.equal(message.line, "ping")
  // assert.equal(message.error, false)

  await session.close()
}, 10000)

test('test default on exit', async () => {
  const onExit = vi.fn(() => {})

  const session = await Session.create({ id: 'Nodejs', onExit })
  const processOverride = await session.process.start({
    cmd: 'pwd',
    onExit: console.log,
  })
  await processOverride.finished
  expect(onExit).not.toHaveBeenCalled()

  const process = await session.process.start({
    cmd: 'pwd',
  })

  await process.finished
  expect(onExit).toHaveBeenCalled()

  await session.close()
})

test('test default on stdout/stderr', async () => {
  const onStdout = vi.fn(() => {})
  const onStderr = vi.fn(() => {})

  const session = await Session.create({ id: 'Nodejs', onStdout, onStderr })

  const processOverride = await session.process.start({
    cmd: "node -e \"console.log('Hello'); throw new Error('Ooopsie -_-')\"",
    onStdout: () => {},
    onStderr: () => {},
  })

  await processOverride.finished
  expect(onStdout).not.toHaveBeenCalled()
  expect(onStderr).not.toHaveBeenCalled()

  const process = await session.process.start({
    cmd: "node -e \"console.log('Hello'); throw new Error('Ooopsie -_-')\"",
  })

  await process.finished
  expect(onStdout).toHaveBeenCalledOnce()
  expect(onStderr).toHaveBeenCalled()
  expect(process.output.exitCode).toEqual(1)

  await session.close()
}, 10000)
