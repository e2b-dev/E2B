import * as e2b from 'e2b'

import { createDeferredPromise } from './utils/promise'

function getStdoutSize() {
  return {
    cols: process.stdout.columns,
    rows: process.stdout.rows,
  }
}

export async function spawnConnectedTerminal(
  terminal: e2b.TerminalManager,
  introText: string,
  exitText: string,
) {
  const { promise: exited, resolve: onExit } = createDeferredPromise()

  // Clear local terminal emulator before starting terminal
  // process.stdout.write('\x1b[2J\x1b[0f')

  console.log(introText)

  const terminalSession = await terminal.start({
    onData: (data: any) => {
      process.stdout.write(data)
    },
    size: getStdoutSize(),
    onExit,
    envVars: {
      TERM: 'xterm-256color',
    },
  })

  process.stdin.setEncoding('utf8')
  process.stdin.setRawMode(true)

  process.stdout.setEncoding('utf8')

  const resizeListener = process.stdout.on('resize', () =>
    terminalSession.resize(getStdoutSize()),
  )

  const stdinListener = process.stdin.on('data', (data) =>
    terminalSession.sendData(data.toString('utf8')),
  )

  exited.then(() => {
    console.log(exitText)
    resizeListener.destroy()
    stdinListener.destroy()
  })

  return {
    kill: terminalSession.kill.bind(terminalSession),
    exited,
  }
}
