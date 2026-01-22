import * as e2b from 'e2b'
import {
  CommandExitError,
  TimeoutError,
  NotFoundError,
  AuthenticationError,
  InvalidArgumentError,
} from 'e2b'
import * as commander from 'commander'

import { ensureAPIKey } from '../../api'

export const execCommand = new commander.Command('exec')
  .description('execute a command in a running sandbox')
  .argument('<sandboxID>', 'sandbox ID to execute command in')
  .argument('<command...>', 'command to execute')
  .option('-b, --background', 'run in background and return immediately')
  .option('-c, --cwd <dir>', 'working directory')
  .option('-u, --user <user>', 'run as specified user')
  .option(
    '-e, --env <KEY=VALUE>',
    'set environment variable (repeatable)',
    (value: string, previous: Record<string, string>) => {
      const [key, ...rest] = value.split('=')
      if (key && rest.length > 0) {
        previous[key] = rest.join('=')
      }
      return previous
    },
    {} as Record<string, string>
  )
  .option(
    '-t, --timeout <ms>',
    'timeout in milliseconds (default 0 = no timeout)',
    parseInt,
    0
  )
  .alias('ex')
  .action(
    async (sandboxID: string, commandParts: string[], opts: ExecOptions) => {
      try {
        const apiKey = ensureAPIKey()
        const command = commandParts.join(' ')
        const sandbox = await e2b.Sandbox.connect(sandboxID, { apiKey })

        if (opts.background) {
          const handle = await sandbox.commands.run(command, {
            background: true,
            cwd: opts.cwd,
            user: opts.user,
            envs: opts.env,
            timeoutMs: opts.timeout,
          })

          console.error(handle.pid)

          handle.disconnect()

          process.exit(0)
        }

        await runCommand(sandbox, command, opts)

        process.exit(0)
      } catch (err: any) {
        handleExecError(err, sandboxID)
      }
    }
  )

interface ExecOptions {
  background?: boolean
  cwd?: string
  user?: string
  env?: Record<string, string>
  timeout?: number
}

function setupSignalHandlers(onSignal: () => Promise<void>): () => void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']

  const handler = async (signal: NodeJS.Signals) => {
    await onSignal()
    process.exit(signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 129)
  }

  signals.forEach((sig) => process.on(sig, handler))

  return () => signals.forEach((sig) => process.removeListener(sig, handler))
}

function setupStdinForwarding(sendStdin: (data: string) => Promise<void>) {
  const bufferedData: Buffer[] = []
  let ended = false

  process.stdin.on('data', (data) => bufferedData.push(data))
  process.stdin.on('end', () => {
    ended = true
  })
  process.stdin.resume()

  return {
    ended: () => ended,
    async flushBuffered() {
      if (bufferedData.length > 0) {
        const combined = Buffer.concat(bufferedData).toString()
        bufferedData.length = 0
        try {
          await sendStdin(combined)
        } catch {
          // Command may have exited
        }
      }
    },
    startForwarding() {
      process.stdin.removeAllListeners('data')
      process.stdin.on('data', async (data) => {
        try {
          await sendStdin(data.toString())
        } catch {
          // Command may have exited
        }
      })
    },
    cleanup() {
      process.stdin.pause()
      process.stdin.removeAllListeners()
    },
  }
}

async function runCommand(
  sandbox: e2b.Sandbox,
  command: string,
  opts: ExecOptions
) {
  const hasPipedInput = !process.stdin.isTTY
  const stdinForwarder = hasPipedInput
    ? setupStdinForwarding((data) =>
        sandbox.commands.sendStdin(handle.pid, data)
      )
    : null

  const handle = await sandbox.commands.run(command, {
    background: true,
    stdin: hasPipedInput,
    cwd: opts.cwd,
    user: opts.user,
    envs: opts.env,
    timeoutMs: opts.timeout,
    onStdout: (data) => {
      process.stdout.write(data)
    },
    onStderr: (data) => {
      process.stderr.write(data)
    },
  })

  if (stdinForwarder) {
    await stdinForwarder.flushBuffered()

    if (!stdinForwarder.ended()) {
      stdinForwarder.startForwarding()
    }
  }

  const removeSignalHandlers = setupSignalHandlers(async () => {
    await handle.kill().catch(() => {})
  })

  try {
    const result = await handle.wait()

    if (result.exitCode !== 0) {
      process.exit(result.exitCode)
    }
  } catch (err) {
    if (err instanceof CommandExitError) {
      process.exit(err.exitCode)
    }

    throw err
  } finally {
    removeSignalHandlers()
    stdinForwarder?.cleanup()
  }
}

function handleExecError(err: unknown, sandboxID: string): never {
  // Command exited with non-zero - propagate exit code silently
  if (err instanceof CommandExitError) {
    process.exit(err.exitCode)
  }

  // Timeout from -t flag (exit 124, like Linux timeout command)
  if (err instanceof TimeoutError) {
    console.error('e2b: command timed out')
    process.exit(124)
  }

  // Sandbox not found
  if (err instanceof NotFoundError) {
    console.error(`e2b: sandbox '${sandboxID}' not found`)
    process.exit(1)
  }

  // Authentication failed
  if (err instanceof AuthenticationError) {
    console.error('e2b: authentication failed - check E2B_API_KEY')
    process.exit(1)
  }

  // Invalid argument - translate SDK params to CLI flags
  if (err instanceof InvalidArgumentError) {
    let message = err.message
    message = message.replace(/\bcwd\b/gi, '--cwd')
    message = message.replace(/\buser\b/gi, '--user')
    message = message.replace(/\benvs?\b/gi, '--env')
    message = message.replace(/\btimeoutMs\b/gi, '--timeout')
    console.error(`e2b: ${message}`)
    process.exit(1)
  }

  // Generic error - translate common SDK params to CLI flags
  const errMessage = err instanceof Error ? err.message : String(err)
  let message = errMessage
  message = message.replace(/\btimeoutMs\b/gi, '--timeout')
  console.error(`e2b: ${message}`)
  process.exit(1)
}
