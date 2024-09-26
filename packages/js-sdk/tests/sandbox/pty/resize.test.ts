import { sandboxTest } from '../../setup'
import { assert } from 'vitest'

sandboxTest('resize', async ({ sandbox }) => {
  let output = ''
  const decoder = new TextDecoder()
  const appendData = (data: Uint8Array) => {
    output += decoder.decode(data)
  }

  const terminal = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    onData: appendData,
  })

  await sandbox.pty.sendInput(
    terminal.pid,
    new Uint8Array(Buffer.from('tput cols\nexit\n'))
  )

  await terminal.wait()
  assert.equal(terminal.exitCode, 0)
  assert.include(output, '80')

  output = ''

  const resizedTerminal = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    onData: appendData,
  })
  await sandbox.pty.resize(resizedTerminal.pid, { cols: 100, rows: 24 })
  await sandbox.pty.sendInput(
    resizedTerminal.pid,
    new Uint8Array(Buffer.from('tput cols\nexit\n'))
  )

  await resizedTerminal.wait()
  assert.equal(resizedTerminal.exitCode, 0)
  assert.include(output, '100')
})
