import * as e2b from 'e2b'
import {wait} from './utils/wait'


function getStdoutSize() {
  return {
    cols: process.stdout.columns,
    rows: process.stdout.rows,
  }
}

export async function spawnConnectedTerminal(
  sandbox: e2b.Sandbox,
  introText: string,
  exitText: string,
) {
  // Clear local terminal emulator before starting terminal
  // process.stdout.write('\x1b[2J\x1b[0f')

  console.log(introText)

  const terminalSession = await sandbox.pty.create({
    onData: (data: Uint8Array) => process.stdout.write(data),
    ...getStdoutSize()
  })

  // TODO: missing newlines
  process.stdin.setRawMode(true)
  process.stdout.setEncoding('utf8')

  const resizeListener = process.stdout.on('resize', () => sandbox.pty.resize(terminalSession.pid, getStdoutSize()))
  const stdinListener = process.stdin.on('data', async (data) => await sandbox.pty.sendInput(terminalSession.pid, data))

  const exited = async () => {
    // TODO: handle exit
    await wait(1000_000)
    await terminalSession.wait()
    await input.stop()
    console.log(exitText)
    resizeListener.destroy()
    stdinListener.destroy()
  }

  return {
    kill: terminalSession.kill.bind(terminalSession),
    exited,
  }
}
