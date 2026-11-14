import { afterEach, expect, test, vi } from 'vitest'

import { Sandbox } from '../src'

afterEach(() => {
  vi.restoreAllMocks()
})

async function startedDesktop() {
  const run = vi.fn(async (cmd: string) => {
    if (cmd === 'pgrep -x x11vnc') {
      return { stdout: '' }
    }
    return { stdout: '', kill: vi.fn(), disconnect: vi.fn() }
  })
  const sandbox = Object.create(Sandbox.prototype) as Sandbox
  // startXfce4() and _start() are not public; create() calls them.
  const internals = sandbox as unknown as {
    startXfce4(): Promise<void>
    _start(display: string): Promise<void>
  }
  Object.defineProperty(sandbox, 'commands', { value: { run } })
  vi.spyOn(sandbox, 'getHost').mockImplementation(
    (port: number) => `${port}-sbx.e2b.app`
  )
  const waitAndVerify = vi
    .spyOn(sandbox, 'waitAndVerify')
    .mockResolvedValue(true)
  vi.spyOn(internals, 'startXfce4').mockResolvedValue(undefined)

  // Sets up sandbox.stream the same way create() does.
  await internals._start(':0')
  run.mockClear()
  waitAndVerify.mockClear()

  return { sandbox, run, waitAndVerify }
}

test('stream.start() runs noVNC on the requested ports', async () => {
  const { sandbox, run, waitAndVerify } = await startedDesktop()

  await sandbox.stream.start({ vncPort: 5901, port: 6081 })

  const commands = run.mock.calls.map(([cmd]) => cmd)
  const x11vnc = commands.find((cmd) => cmd.startsWith('x11vnc -bg'))
  const novnc = commands.find((cmd) => cmd.includes('novnc_proxy'))

  expect(x11vnc).toContain('-rfbport 5901')
  expect(novnc).toContain('--vnc localhost:5901')
  expect(novnc).toContain('--listen 6081')
  expect(waitAndVerify).toHaveBeenCalledWith(
    expect.stringContaining(':6081 '),
    expect.any(Function)
  )
  expect(sandbox.stream.getUrl()).toContain('https://6081-sbx.e2b.app/')
})

test('stream.start() keeps the default ports when none are given', async () => {
  const { sandbox, run } = await startedDesktop()

  await sandbox.stream.start()

  const novnc = run.mock.calls
    .map(([cmd]) => cmd)
    .find((cmd) => cmd.includes('novnc_proxy'))

  expect(novnc).toContain('--vnc localhost:5900')
  expect(novnc).toContain('--listen 6080')
})
