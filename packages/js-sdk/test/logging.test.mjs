import { Sandbox } from '../src'
import { expect, test, vi } from 'vitest'

import { id } from './setup.mjs'

test.skip('no logs in console during very basic scenario', async () => {
  const consoleSpy = {
    debug: vi.spyOn(console, 'debug'),
    info: vi.spyOn(console, 'info'),
    warn: vi.spyOn(console, 'warn'),
    error: vi.spyOn(console, 'error')
  }

  const sandbox = await Sandbox.create({ id })
  await sandbox.filesystem.write('test.txt', 'Hello World')
  await sandbox.close()

  expect(consoleSpy.debug).toHaveBeenCalledTimes(0)
  expect(consoleSpy.info).toHaveBeenCalledTimes(2)
  expect(consoleSpy.error).toHaveBeenCalledTimes(0)
})

// TODO: Re-enable https://e2b-team.slack.com/archives/C05AGT4UFMJ/p1694697558738799?thread_ts=1694697479.308769&cid=C05AGT4UFMJ
test.skip('warn logs in console during convoluted scenario', async () => {
  const consoleSpy = {
    debug: vi.spyOn(console, 'debug'),
    info: vi.spyOn(console, 'info'),
    warn: vi.spyOn(console, 'warn'),
    error: vi.spyOn(console, 'error')
  }

  const sandbox = await Sandbox.create({ id })
  await sandbox.close() // Note that we are intentionally closing and then trying to write
  const warnsAmount = consoleSpy.warn.mock.calls.length

  // void to explicitly not awaiting, we wanna check if logging is happening correctly during retries
  void sandbox.filesystem.read('/etc/hosts') // this should trigger retries
  setTimeout(() => {
    expect(consoleSpy.warn.mock.calls.length).toBeGreaterThan(warnsAmount) // should have logged a warning
  }, 2000) // wait for some retries to occur
})

test.skip('verbose & info logs in console when opted-in', async () => {
  const consoleSpy = {
    info: vi.spyOn(console, 'info'),
    warn: vi.spyOn(console, 'warn'),
    error: vi.spyOn(console, 'error')
  }

  const logger = {
    info: console.info,
    warn: console.warn,
    error: console.error
  }

  const sandbox = await Sandbox.create({
    id,
    logger
  })
  await sandbox.filesystem.write('test.txt', 'Hello World')
  await sandbox.close()

  expect(consoleSpy.info).toHaveBeenCalled()
  expect(consoleSpy.error).toHaveBeenCalledTimes(0)
})
