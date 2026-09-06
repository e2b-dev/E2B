import { afterEach, expect, test, vi } from 'vitest'
import { CommandExitError, Sandbox as BaseSandbox } from 'e2b'

import {
  DesktopStartupError,
  Sandbox,
  SandboxError,
  TimeoutError,
} from '../src'

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

test.each([true, false])(
  'preserves the startup error when cleanup returns %s',
  async (killed) => {
    const startupError = new TimeoutError('Could not start XFCE')
    const sandbox = {
      _start: vi.fn().mockRejectedValue(startupError),
      kill: vi.fn().mockResolvedValue(killed),
    }
    vi.spyOn(BaseSandbox, 'create').mockResolvedValue(
      sandbox as unknown as BaseSandbox
    )

    await expect(Sandbox.create()).rejects.toBe(startupError)

    expect(sandbox.kill).toHaveBeenCalledOnce()
  }
)

test.each([
  {
    startupError: new TimeoutError('Could not start XFCE'),
    cleanupError: new Error('Synthetic cleanup transport failure'),
  },
  {
    startupError: Object.freeze(new TimeoutError('Could not start Xvfb')),
    cleanupError: Object.freeze(new Error('Synthetic cleanup timeout')),
  },
  { startupError: 'Synthetic startup rejection', cleanupError: null },
])(
  'retains allocation and both failures without modifying the startup error',
  async ({ startupError, cleanupError }) => {
    const sandbox = {
      sandboxId: 'synthetic-owned-sandbox',
      _start: vi.fn().mockRejectedValue(startupError),
      kill: vi.fn().mockRejectedValue(cleanupError),
    }
    vi.spyOn(BaseSandbox, 'create').mockResolvedValue(
      sandbox as unknown as BaseSandbox
    )

    const error = await Sandbox.create().catch((error) => error)

    expect(error).toBeInstanceOf(DesktopStartupError)
    expect(error).toBeInstanceOf(SandboxError)
    expect(error.name).toBe('DesktopStartupError')
    expect(error.sandboxId).toBe(sandbox.sandboxId)
    expect(error.cause).toBe(startupError)
    expect(error.cleanupError).toBe(cleanupError)
    expect(sandbox.kill).toHaveBeenCalledOnce()
  }
)

test('returns a successfully started sandbox without attempting cleanup', async () => {
  const sandbox = {
    _start: vi.fn().mockResolvedValue(undefined),
    kill: vi.fn(),
  }
  vi.spyOn(BaseSandbox, 'create').mockResolvedValue(
    sandbox as unknown as BaseSandbox
  )

  await expect(Sandbox.create()).resolves.toBe(sandbox)

  expect(sandbox._start).toHaveBeenCalledOnce()
  expect(sandbox.kill).not.toHaveBeenCalled()
})

test('preserves allocation failures before a desktop exists', async () => {
  const allocationError = new Error('Synthetic allocation failure')
  vi.spyOn(BaseSandbox, 'create').mockRejectedValue(allocationError)

  await expect(Sandbox.create()).rejects.toBe(allocationError)
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
