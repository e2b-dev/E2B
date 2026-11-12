import { expect, test, vi } from 'vitest'

import { Sandbox } from '../src'

type TestSandbox = Sandbox & {
  _start(display: string): Promise<void>
  startXfce4(): Promise<void>
}

async function desktopWithStream() {
  const run = vi.fn().mockResolvedValue({
    pid: 42,
    stdout: '',
    disconnect: vi.fn().mockResolvedValue(undefined),
  })
  const sandbox = Object.create(Sandbox.prototype) as TestSandbox
  Object.defineProperty(sandbox, 'commands', { value: { run } })
  vi.spyOn(sandbox, 'getHost').mockReturnValue('example.com')
  vi.spyOn(sandbox, 'waitAndVerify').mockResolvedValue(true)
  vi.spyOn(sandbox, 'startXfce4').mockResolvedValue(undefined)

  await sandbox._start(':0')
  run.mockClear()

  return { sandbox, run }
}

function startedVncCommand(run: ReturnType<typeof vi.fn>): string {
  const call = run.mock.calls.find(([command]) =>
    command.startsWith('x11vnc -bg')
  )
  expect(call).toBeDefined()
  return call?.[0] as string
}

test('uses cursor shape updates by default', async () => {
  const { sandbox, run } = await desktopWithStream()

  await sandbox.stream.start()

  expect(startedVncCommand(run)).not.toContain('-nocursorshape')
})

test('composites the cursor into framebuffer updates for spectators', async () => {
  const { sandbox, run } = await desktopWithStream()

  await sandbox.stream.start({ cursor: 'composite' })

  expect(startedVncCommand(run)).toContain(' -nocursorshape ')
})
