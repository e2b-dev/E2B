import * as e2b from 'e2b'

function getStdoutSize() {
  return {
    cols: process.stdout.columns,
    rows: process.stdout.rows,
  }
}

export interface TerminalOpts {
  user?: e2b.Username
  cwd?: string
  envs?: Record<string, string>
}

export async function spawnConnectedTerminal(
  sandbox: e2b.Sandbox,
  opts: TerminalOpts = {}
) {
  // Clear local terminal emulator before starting terminal
  // process.stdout.write('\x1b[2J\x1b[0f')

  process.stdin.setRawMode(true)
  process.stdout.setEncoding('utf-8')

  const terminalSession = await sandbox.pty.create({
    onData: (data) => {
      process.stdout.write(data)
    },
    ...getStdoutSize(),
    timeoutMs: 0,
    ...(opts.user !== undefined ? { user: opts.user } : {}),
    ...(opts.cwd !== undefined ? { cwd: opts.cwd } : {}),
    ...(opts.envs !== undefined ? { envs: opts.envs } : {}),
  })

  const openInput = () =>
    sandbox.pty.streamInput(terminalSession.pid, { timeoutMs: 0 })
  let input = openInput()
  let closed = false
  let inputErrorReported = false

  const resizeListener = () =>
    sandbox.pty.resize(terminalSession.pid, getStdoutSize())
  const sendInput = (data: Buffer, retried = false): void => {
    const handle = input
    handle.send(data).then(
      () => {
        inputErrorReported = false
      },
      (err) => {
        if (closed) return
        if (input === handle) input = openInput()
        if (!retried) return sendInput(data, true)
        if (inputErrorReported) {
          return
        }
        inputErrorReported = true
        console.error('Error sending input:', err)
      }
    )
  }
  const stdinListener = (data: Buffer) => sendInput(data)
  process.stdout.on('resize', resizeListener)
  process.stdin.on('data', stdinListener)

  // Wait for terminal session to finish
  try {
    await terminalSession.wait()
  } catch (err: any) {
    if (err instanceof e2b.CommandExitError) {
      if (err.exitCode === -1 && err.error === 'signal: killed') {
        return
      }
      if (err.exitCode === 130) {
        console.warn('Terminal session was killed by user')
        return
      }
    }
    throw err
  } finally {
    // Cleanup
    closed = true
    process.stdout.write('\n')
    process.stdout.off('resize', resizeListener)
    process.stdin.off('data', stdinListener)
    await input.close().catch(() => {})
    process.stdin.setRawMode(false)
  }
}
