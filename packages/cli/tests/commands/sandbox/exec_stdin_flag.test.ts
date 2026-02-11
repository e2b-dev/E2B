import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const connect = vi.fn()
  const run = vi.fn()
  const sendStdin = vi.fn()
  const closeStdin = vi.fn()
  const ensureAPIKey = vi.fn(() => 'test-api-key')
  const isPipedStdin = vi.fn()
  const streamStdinChunks = vi.fn()
  const setupSignalHandlers = vi.fn(() => () => {})

  return {
    connect,
    run,
    sendStdin,
    closeStdin,
    ensureAPIKey,
    isPipedStdin,
    streamStdinChunks,
    setupSignalHandlers,
  }
})

vi.mock('e2b', () => {
  class CommandExitError extends Error {
    exitCode: number
    constructor(exitCode: number) {
      super(`Command exited with ${exitCode}`)
      this.exitCode = exitCode
    }
  }

  class NotFoundError extends Error {}

  return {
    Sandbox: {
      connect: mocks.connect,
    },
    CommandExitError,
    NotFoundError,
  }
})

vi.mock('../../../src/api', () => ({
  ensureAPIKey: mocks.ensureAPIKey,
}))

vi.mock('src/utils/signal', () => ({
  setupSignalHandlers: mocks.setupSignalHandlers,
}))

vi.mock('../../../src/commands/sandbox/exec_helpers', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/commands/sandbox/exec_helpers')>()
  return {
    ...actual,
    isPipedStdin: mocks.isPipedStdin,
    streamStdinChunks: mocks.streamStdinChunks,
  }
})

describe('sandbox exec stdin run flag', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    const handle = {
      pid: 1234,
      error: undefined,
      wait: vi.fn().mockResolvedValue({ exitCode: 0 }),
      kill: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }

    mocks.run.mockResolvedValue(handle)
    mocks.sendStdin.mockResolvedValue(undefined)
    mocks.closeStdin.mockResolvedValue(undefined)
    mocks.isPipedStdin.mockReturnValue(false)
    mocks.streamStdinChunks.mockResolvedValue(undefined)
    mocks.connect.mockResolvedValue({
      commands: {
        run: mocks.run,
        sendStdin: mocks.sendStdin,
        closeStdin: mocks.closeStdin,
        supportsStdinClose: true,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('does not pass stdin flag when stdin is not piped', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    const { execCommand } = await import('../../../src/commands/sandbox/exec')
    await execCommand.parseAsync(['sandbox-id', 'echo', 'hello'], {
      from: 'user',
    })

    expect(mocks.run).toHaveBeenCalledTimes(1)
    const runOpts = mocks.run.mock.calls[0][1]
    expect(runOpts).not.toHaveProperty('stdin')
    expect(mocks.streamStdinChunks).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('passes stdin: true when stdin piping is active', async () => {
    mocks.isPipedStdin.mockReturnValue(true)
    mocks.streamStdinChunks.mockImplementation(
      async (
        _stream: NodeJS.ReadableStream,
        onChunk: (chunk: Uint8Array) => Promise<void>,
        _maxBytes: number
      ) => {
        await onChunk(Buffer.from('hello'))
      }
    )
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    const { execCommand } = await import('../../../src/commands/sandbox/exec')
    await execCommand.parseAsync(['sandbox-id', 'cat'], {
      from: 'user',
    })

    expect(mocks.run).toHaveBeenCalledTimes(1)
    const runOpts = mocks.run.mock.calls[0][1]
    expect(runOpts).toHaveProperty('stdin', true)
    expect(mocks.streamStdinChunks).toHaveBeenCalled()
    expect(mocks.sendStdin).toHaveBeenCalled()
    expect(mocks.closeStdin).toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})
