import * as e2b from 'e2b'

const FLUSH_INPUT_INTERVAL_MS = 10

function getStdoutSize() {
  return {
    cols: process.stdout.columns,
    rows: process.stdout.rows,
  }
}

export async function spawnConnectedTerminal(sandbox: e2b.Sandbox) {
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
  })

  const inputQueue = new BatchedQueue<Buffer>(async (batch) => {
    const combined = Buffer.concat(batch)
    await sandbox.pty.sendInput(terminalSession.pid, combined)
  }, FLUSH_INPUT_INTERVAL_MS)

  const resizeListener = process.stdout.on('resize', () =>
    sandbox.pty.resize(terminalSession.pid, getStdoutSize())
  )
  const stdinListener = process.stdin.on('data', (data) => {
    inputQueue.push(data)
  })

  inputQueue.start()

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
    process.stdout.write('\n')
    resizeListener.destroy()
    stdinListener.destroy()
    await inputQueue.stop()
    process.stdin.setRawMode(false)
  }
}

class BatchedQueue<T> {
  private queue: T[] = []
  private isFlushing = false
  private intervalId?: NodeJS.Timeout

  constructor(
    private flushHandler: (batch: T[]) => Promise<void>,
    private flushIntervalMs: number
  ) {}

  push(item: T) {
    this.queue.push(item)
  }

  start() {
    this.intervalId = setInterval(async () => {
      if (this.isFlushing) return

      this.isFlushing = true
      await this.flush()
      this.isFlushing = false
    }, this.flushIntervalMs)
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    await this.flush()
  }

  private async flush() {
    if (this.queue.length === 0) return

    const batch = this.queue.splice(0, this.queue.length)
    try {
      await this.flushHandler(batch)
    } catch (err) {
      console.error('Error sending input:', err)
    }
  }
}
