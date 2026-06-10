import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const create = vi.fn()
  const ensureAPIKey = vi.fn(() => 'test-api-key')
  const spawnConnectedTerminal = vi.fn()

  return {
    create,
    ensureAPIKey,
    spawnConnectedTerminal,
  }
})

vi.mock('e2b', () => ({
  Sandbox: {
    create: mocks.create,
  },
}))

vi.mock('../../../src/api', () => ({
  ensureAPIKey: mocks.ensureAPIKey,
}))

vi.mock('src/utils/urls', () => ({
  printDashboardSandboxInspectUrl: vi.fn(),
}))

vi.mock('src/terminal', () => ({
  spawnConnectedTerminal: mocks.spawnConnectedTerminal,
}))

describe('sandbox create lifecycle options', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.create.mockResolvedValue({
      sandboxId: 'sandbox-id',
      setTimeout: vi.fn().mockResolvedValue(undefined),
    })
    mocks.spawnConnectedTerminal.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('passes ontimeout and autoresume to Sandbox.create', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    const { createCommand } = await import(
      '../../../src/commands/sandbox/create'
    )
    await createCommand('create', 'cr', false).parseAsync(
      ['base', '--detach', '--ontimeout', 'pause', '--autoresume'],
      { from: 'user' }
    )

    expect(mocks.create).toHaveBeenCalledWith('base', {
      apiKey: 'test-api-key',
      lifecycle: {
        onTimeout: 'pause',
        autoResume: true,
      },
    })
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('passes ontimeout without autoresume to Sandbox.create', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    const { createCommand } = await import(
      '../../../src/commands/sandbox/create'
    )
    await createCommand('create', 'cr', false).parseAsync(
      ['base', '--detach', '--ontimeout', 'kill'],
      { from: 'user' }
    )

    expect(mocks.create).toHaveBeenCalledWith('base', {
      apiKey: 'test-api-key',
      lifecycle: {
        onTimeout: 'kill',
      },
    })
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('passes timeout seconds to Sandbox.create as milliseconds', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    const { createCommand } = await import(
      '../../../src/commands/sandbox/create'
    )
    await createCommand('create', 'cr', false).parseAsync(
      ['base', '--detach', '--timeout', '120'],
      { from: 'user' }
    )

    expect(mocks.create).toHaveBeenCalledWith('base', {
      apiKey: 'test-api-key',
      timeoutMs: 120_000,
    })
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('preserves explicit timeout after attached terminal closes', async () => {
    vi.useFakeTimers()
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    const sandbox = {
      sandboxId: 'sandbox-id',
      setTimeout: vi.fn().mockResolvedValue(undefined),
    }
    mocks.create.mockResolvedValue(sandbox)

    const { createCommand } = await import(
      '../../../src/commands/sandbox/create'
    )
    await createCommand('create', 'cr', false).parseAsync(
      ['base', '--timeout', '120'],
      { from: 'user' }
    )

    expect(mocks.spawnConnectedTerminal).toHaveBeenCalledWith(sandbox)
    expect(sandbox.setTimeout).toHaveBeenCalledWith(120_000)
    expect(sandbox.setTimeout).not.toHaveBeenCalledWith(1_000)
    expect(exitSpy).toHaveBeenCalledWith(0)
    vi.useRealTimers()
  })

  test('rejects autoresume without pause on timeout', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { createCommand } = await import(
      '../../../src/commands/sandbox/create'
    )
    await createCommand('create', 'cr', false).parseAsync(
      ['base', '--detach', '--ontimeout', 'kill', '--autoresume'],
      { from: 'user' }
    )

    expect(mocks.create).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '--autoresume requires --ontimeout pause',
      })
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('rejects invalid ontimeout option', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    const { createCommand } = await import(
      '../../../src/commands/sandbox/create'
    )
    await expect(
      createCommand('create', 'cr', false).parseAsync(
        ['base', '--detach', '--ontimeout', 'hibernate'],
        { from: 'user' }
      )
    ).rejects.toThrow('--ontimeout must be "pause" or "kill"')

    expect(mocks.create).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('rejects zero timeout before creating sandbox', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    const { createCommand } = await import(
      '../../../src/commands/sandbox/create'
    )
    await expect(
      createCommand('create', 'cr', false).parseAsync(
        ['base', '--detach', '--timeout', '0'],
        { from: 'user' }
      )
    ).rejects.toThrow('--timeout must be at least 30 seconds')

    expect(mocks.create).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('rejects timeout values shorter than the keep-alive interval', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    const { createCommand } = await import(
      '../../../src/commands/sandbox/create'
    )
    await expect(
      createCommand('create', 'cr', false).parseAsync(
        ['base', '--detach', '--timeout', '29.999'],
        { from: 'user' }
      )
    ).rejects.toThrow('--timeout must be at least 30 seconds')

    expect(mocks.create).not.toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('passes lifecycle and timeout together to Sandbox.create', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)

    const { createCommand } = await import(
      '../../../src/commands/sandbox/create'
    )
    await createCommand('create', 'cr', false).parseAsync(
      [
        'base',
        '--detach',
        '--timeout',
        '120',
        '--ontimeout',
        'pause',
        '--autoresume',
      ],
      { from: 'user' }
    )

    expect(mocks.create).toHaveBeenCalledWith('base', {
      apiKey: 'test-api-key',
      lifecycle: {
        onTimeout: 'pause',
        autoResume: true,
      },
      timeoutMs: 120_000,
    })
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})
