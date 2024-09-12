import * as e2b from 'e2b'


function getStdoutSize() {
  return {
    cols: process.stdout.columns,
    rows: process.stdout.rows,
  }
}

const ctrlCSequence = '\u0003' // ASCII escape sequence for CTRL+C


export async function spawnConnectedTerminal(sandbox: e2b.Sandbox) {
  // Clear local terminal emulator before starting terminal
  // process.stdout.write('\x1b[2J\x1b[0f')

  process.stdin.setRawMode(true)
  process.stdout.setEncoding('utf-8')


  const terminalSession = await sandbox.pty.create({
      onData: data => {
        process.stdout.write(data)
      },
      ...getStdoutSize(),
      timeoutMs: 0,
    })


  const resizeListener = process.stdout.on('resize', () => sandbox.pty.resize(terminalSession.pid, getStdoutSize()))
  const stdinListener = process.stdin.on('data', async (data) => {
    if (data.toString() === ctrlCSequence) {
      process.stdout.write('^C')
      await sandbox.commands.kill(terminalSession.pid)
      return
    }

    await sandbox.pty.sendInput(terminalSession.pid, data)
  })

  // Wait for terminal session to finish
  try {
    await terminalSession.wait()
  } catch (err: any) {
    if (err instanceof e2b.ProcessExitError) {
      if (err.exitCode === -1 && err.error === 'signal: killed') {
        return
      }
    }
    throw err
  } finally {
    // Cleanup
    process.stdout.write('\n')
    resizeListener.destroy()
    stdinListener.destroy()
    process.stdin.setRawMode(false)
  }
}
