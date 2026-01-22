/**
 * Execute a command in a running sandbox.
 *
 * NOTE: Stdin piping (e.g., `echo "data" | e2b exec sandbox cmd`) is not supported.
 * The SDK/envd protocol lacks a way to signal EOF to remote commands. Commands that
 * read until EOF (cat, grep, wc, etc.) would hang indefinitely. This requires envd
 * to add stdin close signaling before it can be implemented.
 */

import * as fs from 'fs'
import * as os from 'os'

import * as e2b from 'e2b'
import {
  CommandExitError,
  SandboxError,
  TimeoutError,
  NotFoundError,
  AuthenticationError,
  InvalidArgumentError,
} from 'e2b'
import * as commander from 'commander'

import { ensureAPIKey } from '../../api'

interface ExecOptions {
  background?: boolean
  cwd?: string
  user?: string
  env?: Record<string, string>
}

const NO_COMMAND_TIMEOUT = 0

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
  .alias('ex')
  .action(
    async (sandboxID: string, commandParts: string[], opts: ExecOptions) => {
      // Check if stdin is a pipe (data being piped in) - not supported
      try {
        const stdinStats = fs.fstatSync(0)
        if (stdinStats.isFIFO()) {
          console.error('e2b: stdin piping is not supported')
          process.exit(2)
        }
      } catch {
        // fstatSync may fail in some environments, ignore
      }

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
            timeoutMs: NO_COMMAND_TIMEOUT,
          })

          console.error(handle.pid)

          await handle.disconnect()

          process.exit(0)
        }

        await runCommand(sandbox, command, opts)

        process.exit(0)
      } catch (err: any) {
        handleExecError(err, sandboxID)
      }
    }
  )

function getSignalExitCode(signal: NodeJS.Signals): number {
  // Standard Unix convention: 128 + signal number
  const signalNumber = os.constants.signals[signal] ?? 1

  return 128 + signalNumber
}

// Signals we handle - filtered to those defined by the OS
// Note: SIGKILL and SIGSTOP cannot be caught
const HANDLED_SIGNALS = (
  ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'SIGABRT', 'SIGPIPE'] as const
).filter((sig) => sig in os.constants.signals)

function setupSignalHandlers(
  onSignal: (signal: NodeJS.Signals) => Promise<void>
): () => void {
  const handler = (signal: NodeJS.Signals) => onSignal(signal)

  HANDLED_SIGNALS.forEach((sig) => process.on(sig, handler))

  return () =>
    HANDLED_SIGNALS.forEach((sig) => process.removeListener(sig, handler))
}

async function runCommand(
  sandbox: e2b.Sandbox,
  command: string,
  opts: ExecOptions
) {
  const handle = await sandbox.commands.run(command, {
    background: true,
    cwd: opts.cwd,
    user: opts.user,
    envs: opts.env,
    timeoutMs: NO_COMMAND_TIMEOUT,
    onStdout: (data) => {
      process.stdout.write(data)
    },
    onStderr: (data) => {
      process.stderr.write(data)
    },
  })

  let signalExit: number | null = null

  const removeSignalHandlers = setupSignalHandlers(async (signal) => {
    // Mark that we're exiting due to signal
    signalExit = getSignalExitCode(signal)

    // Kill the remote process and wait for it.
    // The exec handler should also remove the signal handler and process exit.
    await handle.kill()
  })

  try {
    const result = await handle.wait()
    removeSignalHandlers()

    if (result.error) {
      console.error(result.error)
    }

    process.exit(result.exitCode)
  } catch (err) {
    removeSignalHandlers()

    // If we're exiting due to a signal, use the signal exit code
    if (signalExit !== null) {
      process.exit(signalExit)
    }

    handleExecError(err, sandbox.sandboxId)
  }
}

function handleExecError(err: unknown, sandboxID: string): never {
  if (err instanceof CommandExitError) {
    process.exit(err.exitCode)
  }

  if (err instanceof TimeoutError) {
    console.error(`e2b: timeout: ${err.message}`)
    process.exit(124)
  }

  if (err instanceof NotFoundError) {
    console.error(`e2b: sandbox '${sandboxID}' not found: ${err.message}`)
    process.exit(1)
  }

  if (err instanceof AuthenticationError) {
    console.error(`e2b: authentication failed - check E2B_API_KEY: ${err.message}`)
    process.exit(1)
  }

  if (err instanceof InvalidArgumentError) {
    console.error(`e2b: invalid argument: ${err.message}`)
    process.exit(1)
  }

  if (err instanceof SandboxError) {
    console.error(`e2b: error: ${err.message}`)
    process.exit(1)
  }

  throw err
}
