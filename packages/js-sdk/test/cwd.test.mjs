import { Sandbox } from '../src'
import { expect, test, vi } from 'vitest'

import { id } from './setup.mjs'
import { CurrentWorkingDirectoryDoesntExistError } from '../src/error'

test('custom cwd', async () => {
  const sandbox = await Sandbox.create({
    id,
    cwd: '/code/app'
  })

  // change dir to /home/user
  sandbox.cwd = '/home/user'

  // process respects cwd
  {
    const proc = await sandbox.process.start({ cmd: 'pwd' })
    await proc.finished
    const out = proc.output.stdout
    expect(out).toEqual('/home/user')
  }

  // filesystem respects cwd
  {
    await sandbox.filesystem.write('hello.txt', 'Hello VM!')
    const proc = await sandbox.process.start({ cmd: 'cat /home/user/hello.txt' })
    await proc.finished
    const out = proc.output.stdout
    expect(out).toEqual('Hello VM!')
  }

  // call cd in process
  {
    const proc = await sandbox.process.start({ cmd: 'cd /code' })
    await proc.finished
  }

  // process doesn't respect cd
  {
    const proc = await sandbox.process.start({ cmd: 'pwd' })
    await proc.finished
    const out = proc.output.stdout
    expect(out).toEqual('/home/user')
  }
  await sandbox.close()
})

test('test_process_cwd', async () => {
  const sandbox = await Sandbox.create({ id, cwd: '/code/app' })
  const proc = await sandbox.process.start({ cmd: 'pwd' })
  await proc.wait()
  expect(proc.output.stdout).toEqual('/code/app')
  await sandbox.close()
})

test('test_filesystem_cwd', async () => {
  const sandbox = await Sandbox.create({ id, cwd: '/code/app' })

  await sandbox.filesystem.write('hello.txt', 'Hello VM!')
  const proc = await sandbox.process.start({ cmd: 'cat /code/app/hello.txt' })

  await proc.wait()
  expect(proc.output.stdout).toEqual('Hello VM!')
  await sandbox.close()
})

test('test_initial_cwd_with_tilde', async () => {
  const sandbox = await Sandbox.create({ id, cwd: '~/code/' })
  const proc = await sandbox.process.start({ cmd: 'pwd' })
  await proc.wait()
  expect(proc.output.stdout).toEqual('/home/user/code')
  await sandbox.close()
})

test('test_relative_paths', async () => {
  const sandbox = await Sandbox.create({ id, cwd: '/home/user' })
  await sandbox.filesystem.makeDir('./code')
  await sandbox.filesystem.write('./code/hello.txt', 'Hello Vasek!')
  const proc = await sandbox.process.start({ cmd: 'cat /home/user/code/hello.txt' })
  await proc.wait()
  expect(proc.output.stdout).toEqual('Hello Vasek!')

  await sandbox.filesystem.write('../../hello.txt', 'Hello Tom!')
  const proc2 = await sandbox.process.start({ cmd: 'cat /hello.txt' })
  await proc2.wait()
  expect(proc2.output.stdout).toEqual('Hello Tom!')

  await sandbox.close()
})

test('test_warnings', async () => {
  const sandbox = await Sandbox.create({
    id,
    logger: { warn: vi.spyOn(console, 'warn') }
  })
  await sandbox.filesystem.write('./hello.txt', 'Hello Vasek!')
  expect(console.warn).toHaveBeenCalledTimes(1)
  await sandbox.filesystem.write('../hello.txt', 'Hello Vasek!')
  expect(console.warn).toHaveBeenCalledTimes(2)
  await sandbox.filesystem.write('~/hello.txt', 'Hello Vasek!')
  expect(console.warn).toHaveBeenCalledTimes(3)
  await sandbox.close()
})

test('test_non_existing_cwd', async () => {
  const sandbox = await Sandbox.create({ id })
  await expect(sandbox.process.start({ cmd: 'pwd', cwd: '/this/does/not/exist' })).rejects.toThrow(CurrentWorkingDirectoryDoesntExistError)
  await sandbox.close()
})
