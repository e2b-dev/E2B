import { sandboxTest } from '../../setup'
import { assert } from 'vitest'

sandboxTest('create PTY', async ({ sandbox }) => {
  let output = ''
  const decoder = new TextDecoder()
  const appendData = (data: Uint8Array) => {
    output += decoder.decode(data)
  }

  const terminal = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    onData: appendData,
    envs: { ABC: '123' },
  })

  await sandbox.pty.sendInput(
    terminal.pid,
    new Uint8Array(Buffer.from('echo $ABC\nexit\n'))
  )

  await terminal.wait()
  assert.equal(terminal.exitCode, 0)

  assert.include(output, '123')
})
