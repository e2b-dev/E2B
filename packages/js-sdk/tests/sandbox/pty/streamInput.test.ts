import { expect } from 'vitest'

import { sandboxTest } from '../../setup'

sandboxTest(
  'stream input to a PTY preserves character order',
  async ({ sandbox }) => {
    let output = ''
    const decoder = new TextDecoder()
    const terminal = await sandbox.pty.create({
      cols: 80,
      rows: 24,
      onData: (data) => {
        output += decoder.decode(data, { stream: true })
      },
    })

    const input = sandbox.pty.streamInput(terminal.pid)
    for (const character of 'echo hello-stream\n') {
      await input.send(character)
    }
    await input.close()

    for (let i = 0; i < 10; i++) {
      if (/(?:^|[\r\n])hello-stream(?:[\r\n]|$)/.test(output)) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    expect(output).toMatch(/(?:^|[\r\n])hello-stream(?:[\r\n]|$)/)
  }
)
