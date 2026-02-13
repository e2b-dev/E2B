import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const connect = vi.fn()
  const run = vi.fn()
  const wait = vi.fn()
  const sendStdin = vi.fn()
  const closeStdin = vi.fn()
  const kill = vi.fn()
  const ensureAPIKey = vi.fn(() => 'test-api-key')
  const isPipedStdin = vi.fn()
  const streamStdinChunks = vi.fn()
  const setupSignalHandlers = vi.fn(() => () => {})

  return {
    connect,
    run,
    wait,
    sendStdin,
    closeStdin,
    kill,
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

describe('sandbox exec closeStdin handling', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.wait.mockResolvedValue({ exitCode: 0 })
    const handle = {
      pid: 1234,
      error: undefined,
      wait: mocks.wait,
      kill: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }

    mocks.run.mockResolvedValue(handle)
    mocks.sendStdin.mockResolvedValue(undefined)
    mocks.closeStdin.mockResolvedValue(undefined)
    mocks.kill.mockResolvedValue(true)
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
    mocks.connect.mockResolvedValue({
      commands: {
        run: mocks.run,
        sendStdin: mocks.sendStdin,
        closeStdin: mocks.closeStdin,
        kill: mocks.kill,
        supportsStdinClose: true,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('fails fast when closeStdin throws non-NotFoundError', async () => {
    mocks.closeStdin.mockRejectedValue(new Error('close failed'))

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { execCommand } = await import('../../../src/commands/sandbox/exec')
    await execCommand.parseAsync(['sandbox-id', 'cat'], {
      from: 'user',
    })

    expect(mocks.closeStdin).toHaveBeenCalledTimes(1)
    expect(mocks.kill).not.toHaveBeenCalled()
    expect(mocks.wait).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('keeps NotFoundError from closeStdin non-fatal', async () => {
    const { NotFoundError } = await import('e2b')
    mocks.closeStdin.mockRejectedValue(new NotFoundError('already exited'))

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { execCommand } = await import('../../../src/commands/sandbox/exec')
    await execCommand.parseAsync(['sandbox-id', 'cat'], {
      from: 'user',
    })

    expect(mocks.closeStdin).toHaveBeenCalledTimes(1)
    expect(mocks.kill).not.toHaveBeenCalled()
    expect(mocks.wait).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('stops stdin streaming after NotFoundError from sendStdin', async () => {
    const { NotFoundError } = await import('e2b')
    mocks.sendStdin.mockRejectedValueOnce(new NotFoundError('already exited'))
    mocks.streamStdinChunks.mockImplementation(
      async (
        _stream: NodeJS.ReadableStream,
        onChunk: (chunk: Uint8Array) => Promise<void | boolean>,
        _maxBytes: number
      ) => {
        const shouldContinue = await onChunk(Buffer.from('first'))
        if (shouldContinue === false) {
          return
        }
        await onChunk(Buffer.from('second'))
      }
    )

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { execCommand } = await import('../../../src/commands/sandbox/exec')
    await execCommand.parseAsync(['sandbox-id', 'cat'], {
      from: 'user',
    })

    expect(mocks.sendStdin).toHaveBeenCalledTimes(1)
    expect(mocks.closeStdin).not.toHaveBeenCalled()
    expect(mocks.wait).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      'e2b: Remote command exited before stdin could be delivered.'
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})
