import * as sdk from '@devbookhq/sdk'

import { createDeferredPromise } from './utils/promise'

function getStdoutSize() {
  return {
    cols: process.stdout.columns,
    rows: process.stdout.rows,
  }
}

export async function spawnConnectedTerminal(
  manager: sdk.TerminalManager,
  introText: string,
  exitText: string,
) {
  const { promise: exited, resolve: onExit } = createDeferredPromise()

  // Clear local terminal emulator before starting terminal
  // process.stdout.write('\x1b[2J\x1b[0f')

  console.log(introText)

  const terminal = await manager.createSession({
    onData: data => process.stdout.write(data),
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
    terminal.resize(getStdoutSize()),
  )

  const stdinListener = process.stdin.on('data', data =>
    terminal.sendData(data.toString('utf8')),
  )

  exited.then(() => {
    console.log(exitText)
    resizeListener.destroy()
    stdinListener.destroy()
  })

  return {
    destroy: terminal.destroy.bind(terminal),
    exited,
  }
}
