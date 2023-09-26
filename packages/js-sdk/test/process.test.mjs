import { Session } from '../src'
import { expect, test, vi } from 'vitest'

const E2B_API_KEY = process.env.E2B_API_KEY

test('process on stdout/stderr', async () => {
  const session = await Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY })

  const stdout = []
  const stderr = []

  const process = await session.process.start({
    cmd: 'pwd',
    onStdout: data => stdout.push(data),
    onStderr: data => stderr.push(data),
    rootdir: '/tmp',
  })

  const output = await process.finished

  expect(output.error).toEqual(false)
  expect(output.stdout).toEqual('/tmp')
  expect(output.stderr).toEqual('')
  expect(stdout.map(message => message.line)).toEqual(['/tmp'])
  expect(stderr).toEqual([])
  await session.close()
})

test('process expected stdout', async () => {
  // TODO: Implement this once we fix envd stdout/stderr race condition
})

test('process expected stderr', async () => {
  // TODO: Implement this once we fix envd stdout/stderr race condition
})

test('process on exit', async () => {
  const session = await Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY })

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
  const session = await Session.create({ id: 'Nodejs', apiKey: E2B_API_KEY })

  const process = await session.process.start({
    cmd: 'read -r line; echo "$line"',
    rootdir: '/code',
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
})
