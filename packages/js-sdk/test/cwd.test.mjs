import { Session } from '../src'
import { expect, test, vi } from 'vitest'

test(
  'custom cwd',
  async () => {
    const session = await Session.create({
      id: 'Nodejs',
      cwd: '/code/app',
    })

    // change dir to /home/user
    session.cwd = '/home/user'

    // process respects cwd
    {
      const proc = await session.process.start({ cmd: 'pwd' })
      await proc.finished
      const out = proc.output.stdout
      expect(out).toEqual('/home/user')
    }

    // filesystem respects cwd
    {
      await session.filesystem.write('hello.txt', 'Hello VM!')
      const proc = await session.process.start({ cmd: 'cat /home/user/hello.txt' })
      await proc.finished
      const out = proc.output.stdout
      expect(out).toEqual('Hello VM!')
    }

    // call cd in process
    {
      const proc = await session.process.start({ cmd: 'cd /code' })
      await proc.finished
    }

    // process doesn't respect cd
    {
      const proc = await session.process.start({ cmd: 'pwd' })
      await proc.finished
      const out = proc.output.stdout
      expect(out).toEqual('/home/user')
    }
    await session.close()
  },
  { timeout: 10_000 },
)

test('test_process_cwd', async () => {
  const session = await Session.create({ id: 'Nodejs', cwd: '/code/app' })
  const proc = await session.process.start({ cmd: 'pwd' })
  await proc.finished
  expect(proc.output.stdout).toEqual('/code/app')
  await session.close()
})

test('test_filesystem_cwd', async () => {
  const session = await Session.create({ id: 'Nodejs', cwd: '/code/app' })

  await session.filesystem.write('hello.txt', 'Hello VM!')
  const proc = await session.process.start({ cmd: 'cat /code/app/hello.txt' })

  await proc.finished
  expect(proc.output.stdout).toEqual('Hello VM!')
  await session.close()
})

test('test_initial_cwd_with_tilde', async () => {
  const session = await Session.create({ id: 'Nodejs', cwd: '~/code/' })
  const proc = await session.process.start({ cmd: 'pwd' })
  await proc.finished
  expect(proc.output.stdout).toEqual('/home/user/code')
  await session.close()
})

test('test_relative_paths', async () => {
  const session = await Session.create({ id: 'Nodejs', cwd: '/home/user' })
  await session.filesystem.makeDir('./code')
  await session.filesystem.write('./code/hello.txt', 'Hello Vasek!')
  const proc = await session.process.start({ cmd: 'cat /home/user/code/hello.txt' })
  await proc.finished
  expect(proc.output.stdout).toEqual('Hello Vasek!')

  await session.filesystem.write('../../hello.txt', 'Hello Tom!')
  const proc2 = await session.process.start({ cmd: 'cat /hello.txt' })
  await proc2.finished
  expect(proc2.output.stdout).toEqual('Hello Tom!')

  await session.close()
})

test('test_warnings', async () => {
  const session = await Session.create({
    id: 'Nodejs',
    logger: { warn: vi.spyOn(console, 'warn') },
  })
  await session.filesystem.write('./hello.txt', 'Hello Vasek!')
  expect(console.warn).toHaveBeenCalledTimes(1)
  await session.filesystem.write('../hello.txt', 'Hello Vasek!')
  expect(console.warn).toHaveBeenCalledTimes(2)
  await session.filesystem.write('~/hello.txt', 'Hello Vasek!')
  expect(console.warn).toHaveBeenCalledTimes(3)
  await session.close()
})
