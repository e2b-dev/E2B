import { expect } from 'vitest'
import { sandboxTest } from '../../setup'

sandboxTest('send stdin', async ({ sandbox }) => {
  const terminal = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    onData: () => null,
  })

  await sandbox.pty.sendStdin(
    terminal.pid,
    new Uint8Array(Buffer.from('exit\n'))
  )

  await terminal.wait()
  expect(terminal.exitCode).toBe(0)
})

sandboxTest('send input (deprecated alias)', async ({ sandbox }) => {
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

sandboxTest('send stdin through handle', async ({ sandbox }) => {
  let output = ''

  const terminal = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    envs: { ABC: '123' },
    onData: (data) => {
      output += new TextDecoder().decode(data)
    },
  })

  // Send input directly through the handle instead of the PID-keyed module method.
  await terminal.sendStdin(new Uint8Array(Buffer.from('echo $ABC\n')))
  await terminal.sendStdin('exit\n')

  await terminal.wait()
  expect(terminal.exitCode).toBe(0)
  expect(output).toContain('123')
})
