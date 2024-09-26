import { expect } from 'vitest'
import { sandboxTest } from '../../setup'

sandboxTest('send input', async ({ sandbox }) => {
  const terminal = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    onData: () => null,
  })

  await sandbox.pty.sendInput(
    terminal.pid,
    new Uint8Array(Buffer.from('exit\n'))
  )

  await terminal.wait()
  expect(terminal.exitCode).toBe(0)
})
