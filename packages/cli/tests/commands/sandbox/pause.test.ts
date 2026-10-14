import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pause: vi.fn(),
  ensureAPIKey: vi.fn(() => 'test-api-key'),
}))

class ServiceBusyError extends Error {}
class SandboxPauseRefusedError extends ServiceBusyError {}

vi.mock('e2b', () => ({
  Sandbox: {
    pause: mocks.pause,
  },
  NotFoundError: class NotFoundError extends Error {},
  ServiceBusyError,
}))

vi.mock('../../../src/api', () => ({
  ensureAPIKey: mocks.ensureAPIKey,
}))

describe('sandbox pause', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function run(...args: string[]) {
    const { pauseCommand } = await import('../../../src/commands/sandbox/pause')
    await pauseCommand.parseAsync(['node', 'e2b', ...args])
  }

  test('pauses without force by default, leaving force out of the options', async () => {
    mocks.pause.mockResolvedValue({ paused: true, forced: false })

    await run('sbx-1')

    expect(mocks.pause).toHaveBeenCalledWith('sbx-1', {
      apiKey: 'test-api-key',
    })
    expect(mocks.pause.mock.calls[0][1]).not.toHaveProperty('force')
    expect(logSpy.mock.calls.flat().join('\n')).toContain('has been paused')
    expect(logSpy.mock.calls.flat().join('\n')).not.toContain('with force')
  })

  test('--force passes force and reports a forced pause', async () => {
    mocks.pause.mockResolvedValue({ paused: true, forced: true })

    await run('sbx-1', '--force')

    expect(mocks.pause).toHaveBeenCalledWith('sbx-1', {
      apiKey: 'test-api-key',
      force: true,
    })
    expect(logSpy.mock.calls.flat().join('\n')).toContain(
      'has been paused with force'
    )
  })

  test('a forced request the API did not force is reported as a plain pause', async () => {
    mocks.pause.mockResolvedValue({ paused: true, forced: false })

    await run('sbx-1', '-f')

    expect(logSpy.mock.calls.flat().join('\n')).not.toContain('with force')
  })

  test('a refused pause prints the API message, not a stack, and exits 1', async () => {
    const message =
      "Sandbox 'sbx-1' cannot be paused right now because the sandbox guest agent is not responding: retry, or pause with force"
    mocks.pause.mockRejectedValue(new SandboxPauseRefusedError(message))
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    await run('sbx-1')

    // The first thing printed is the API message itself; with process.exit
    // mocked the command carries on past it, so only the first call counts.
    expect(errorSpy.mock.calls[0]).toEqual([message])
    expect(exitSpy).toHaveBeenNthCalledWith(1, 1)
  })

  test('an already paused sandbox is reported as such', async () => {
    mocks.pause.mockResolvedValue({ paused: false, forced: false })

    await run('sbx-1')

    expect(logSpy.mock.calls.flat().join('\n')).toContain('is already paused')
  })
})
