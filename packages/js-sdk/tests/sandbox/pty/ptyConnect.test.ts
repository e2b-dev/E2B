import { sandboxTest } from '../../setup'
import { assert } from 'vitest'

sandboxTest('pty connect/reconnect', async ({ sandbox }) => {
  let output1 = ''
  let output2 = ''
  const decoder = new TextDecoder()

  // First, create a terminal and disconnect the onData handler
  const terminal = await sandbox.pty.create({
    cols: 80,
    rows: 24,
    onData: (data: Uint8Array) => {
      output1 += decoder.decode(data)
    },
    envs: { FOO: 'bar' },
  })

  await sandbox.pty.sendInput(
    terminal.pid,
    new Uint8Array(Buffer.from('echo $FOO\n'))
  )

  // Give time for the command output in the first connection
  await new Promise((r) => setTimeout(r, 300))

  await terminal.disconnect()

  // Now connect again, with a new onData handler
  const reconnectHandle = await sandbox.pty.connect(terminal.pid, {
    onData: (data: Uint8Array) => {
      output2 += decoder.decode(data)
    },
  })

  await sandbox.pty.sendInput(
    terminal.pid,
    new Uint8Array(Buffer.from('echo $FOO\nexit\n'))
  )

  await reconnectHandle.wait()

  assert.equal(terminal.pid, reconnectHandle.pid)
  assert.equal(reconnectHandle.exitCode, 0)

  assert.include(output1, 'bar')
  assert.include(output2, 'bar')
})
