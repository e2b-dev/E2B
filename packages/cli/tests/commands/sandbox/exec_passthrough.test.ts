import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const connect = vi.fn()
  const run = vi.fn()
  const ensureAPIKey = vi.fn(() => 'test-api-key')
  const isPipedStdin = vi.fn()
  const setupSignalHandlers = vi.fn(() => () => {})

  return {
    connect,
    run,
    ensureAPIKey,
    isPipedStdin,
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

vi.mock(
  '../../../src/commands/sandbox/exec_helpers',
  async (importOriginal: <T>() => Promise<T>) => {
    const actual =
      await importOriginal<
        typeof import('../../../src/commands/sandbox/exec_helpers')
      >()
    return {
      ...actual,
      isPipedStdin: mocks.isPipedStdin,
    }
  }
)

async function runExec(argv: string[]): Promise<{ command: string; opts: any }> {
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

  const commander = await import('commander')
  const { sandboxCommand } = await import('../../../src/commands/sandbox')
  const program = new commander.Command()
    .enablePositionalOptions()
    .addCommand(sandboxCommand)

  await program.parseAsync(['sandbox', 'exec', ...argv], { from: 'user' })

  expect(mocks.run).toHaveBeenCalledTimes(1)
  return {
    command: mocks.run.mock.calls[0][0],
    opts: mocks.run.mock.calls[0][1],
  }
}

describe('sandbox exec option pass-through', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.run.mockResolvedValue({
      pid: 1234,
      error: undefined,
      wait: vi.fn().mockResolvedValue({ exitCode: 0 }),
      kill: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    })
    mocks.isPipedStdin.mockReturnValue(false)
    mocks.connect.mockResolvedValue({
      commands: {
        run: mocks.run,
        supportsStdinClose: true,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('forwards flags that follow the command to the remote command', async () => {
    const { command } = await runExec([
      'sandbox-id',
      'codex',
      'exec',
      'prompt',
      '--help',
    ])

    expect(command).toBe('codex exec prompt --help')
  })

  test('forwards flags that collide with e2b flags', async () => {
    const { command, opts } = await runExec([
      'sandbox-id',
      'ls',
      '--background',
      '-u',
      'root',
    ])

    expect(command).toBe('ls --background -u root')
    expect(opts.user).toBeUndefined()
  })

  test('still parses e2b options placed before the command', async () => {
    const { command, opts } = await runExec([
      '--user',
      'root',
      '--cwd',
      '/tmp',
      'sandbox-id',
      'ls',
      '-la',
    ])

    expect(command).toBe('ls -la')
    expect(opts.user).toBe('root')
    expect(opts.cwd).toBe('/tmp')
  })

  test('supports -- to separate e2b options from the command', async () => {
    const { command, opts } = await runExec([
      'sandbox-id',
      '--',
      'codex',
      'exec',
      '--help',
    ])

    expect(command).toBe('codex exec --help')
    expect(opts.user).toBeUndefined()
  })
})
