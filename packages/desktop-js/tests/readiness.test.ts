import { afterEach, expect, test, vi } from 'vitest'
import { CommandExitError, Sandbox as BaseSandbox } from 'e2b'

import { Sandbox, TimeoutError } from '../src'

afterEach(() => {
  vi.restoreAllMocks()
})

function desktopWithCommands(run: ReturnType<typeof vi.fn>) {
  const sandbox = Object.create(Sandbox.prototype) as Sandbox & {
    lastXfce4Pid: number | null
    startXfce4(): Promise<void>
  }
  sandbox.lastXfce4Pid = null
  Object.defineProperty(sandbox, 'commands', { value: { run } })
  return sandbox
}

test('waits for the XFCE desktop session before startup completes', async () => {
  const disconnect = vi.fn().mockResolvedValue(undefined)
  const sandbox = desktopWithCommands(
    vi.fn().mockResolvedValue({ pid: 42, disconnect })
  )
  const waitAndVerify = vi
    .spyOn(sandbox, 'waitAndVerify')
    .mockResolvedValue(true)

  await sandbox.startXfce4()

  expect(waitAndVerify).toHaveBeenCalledWith(
    expect.stringContaining('xfce4-session'),
    expect.any(Function),
    60
  )
  expect(disconnect).toHaveBeenCalledOnce()
})

test('fails startup when the XFCE desktop session never becomes ready', async () => {
  const sandbox = desktopWithCommands(
    vi.fn().mockResolvedValue({
      pid: 42,
      disconnect: vi.fn().mockResolvedValue(undefined),
    })
  )
  vi.spyOn(sandbox, 'waitAndVerify').mockResolvedValue(false)

  await expect(sandbox.startXfce4()).rejects.toEqual(
    new TimeoutError('Could not start XFCE')
  )
})

test('kills a sandbox whose desktop session fails to initialize', async () => {
  const startupError = new TimeoutError('Could not start XFCE')
  const sandbox = {
    _start: vi.fn().mockRejectedValue(startupError),
    kill: vi.fn().mockResolvedValue(undefined),
  }
  vi.spyOn(BaseSandbox, 'create').mockResolvedValue(
    sandbox as unknown as BaseSandbox
  )

  await expect(Sandbox.create()).rejects.toBe(startupError)

  expect(sandbox.kill).toHaveBeenCalledOnce()
})

test('waits between readiness probes that exit unsuccessfully', async () => {
  const run = vi
    .fn()
    .mockRejectedValueOnce(
      new CommandExitError({
        exitCode: 1,
        stdout: '',
        stderr: '',
      })
    )
    .mockResolvedValueOnce({ exitCode: 0 })
  const sandbox = desktopWithCommands(run)
  const timeout = vi.spyOn(globalThis, 'setTimeout')

  await expect(
    sandbox.waitAndVerify(
      'readiness-probe',
      (result) => result.exitCode === 0,
      10,
      0
    )
  ).resolves.toBe(true)

  expect(timeout).toHaveBeenCalled()
  expect(run).toHaveBeenCalledTimes(2)
})
