import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class NotFoundError extends Error {}

  return {
    fork: vi.fn(),
    ensureAPIKey: vi.fn(() => 'test-api-key'),
    NotFoundError,
  }
})

vi.mock('e2b', () => ({
  Sandbox: {
    fork: mocks.fork,
  },
  NotFoundError: mocks.NotFoundError,
}))

vi.mock('../../../src/api', () => ({
  ensureAPIKey: mocks.ensureAPIKey,
}))

async function runFork(args: string[]) {
  const exitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never)
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  const errorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)

  const { forkCommand } = await import('../../../src/commands/sandbox/fork')
  await forkCommand.exitOverride().parseAsync(args, { from: 'user' })

  return { exitSpy, logSpy, errorSpy }
}

describe('sandbox fork', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('forks once by default and prints the new sandbox ID', async () => {
    mocks.fork.mockResolvedValue([{ sandboxId: 'fork-1' }])

    const { exitSpy, logSpy } = await runFork(['source-id'])

    expect(mocks.fork).toHaveBeenCalledWith('source-id', {
      apiKey: 'test-api-key',
    })
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledWith('fork-1')
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('passes count and timeout seconds as milliseconds', async () => {
    mocks.fork.mockResolvedValue([
      { sandboxId: 'fork-1' },
      { sandboxId: 'fork-2' },
    ])

    const { exitSpy, logSpy } = await runFork([
      'source-id',
      '--count',
      '2',
      '--timeout',
      '120',
    ])

    expect(mocks.fork).toHaveBeenCalledWith('source-id', {
      apiKey: 'test-api-key',
      count: 2,
      timeoutMs: 120_000,
    })
    expect(logSpy.mock.calls.map(([line]: unknown[]) => line)).toEqual([
      'fork-1',
      'fork-2',
    ])
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('prints successful forks and exits 1 when any fork fails', async () => {
    const failure = new Error('rate limited')
    mocks.fork.mockResolvedValue([{ sandboxId: 'fork-1' }, failure])

    const { exitSpy, logSpy, errorSpy } = await runFork([
      'source-id',
      '-n',
      '2',
    ])

    expect(logSpy).toHaveBeenCalledWith('fork-1')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const [message] = errorSpy.mock.calls[0] as [string]
    expect(message).toContain('2')
    expect(message).toContain('source-id')
    expect(message).toContain('failed: rate limited')
    expect(message).not.toContain('at ')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('reports a missing source sandbox', async () => {
    mocks.fork.mockRejectedValue(new mocks.NotFoundError('not found'))

    const { exitSpy, errorSpy } = await runFork(['missing-id'])

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('missing-id'))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test.each(['0', '101', '1.5', 'abc'])(
    'rejects count %s',
    async (count: string) => {
      await expect(runFork(['source-id', '--count', count])).rejects.toThrow(
        '--count must be an integer between 1 and 100'
      )
      expect(mocks.fork).not.toHaveBeenCalled()
    }
  )
})
