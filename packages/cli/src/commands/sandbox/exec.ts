/**
 * Execute a command in a running sandbox.
 *
 * NOTE: Stdin piping (e.g., `echo "data" | e2b exec sandbox cmd`) is not supported.
 * The SDK/envd protocol lacks a way to signal EOF to remote commands. Commands that
 * read until EOF (cat, grep, wc, etc.) would hang indefinitely. This requires envd
 * to add stdin close signaling before it can be implemented.
 */

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
      // Warn if stdin is being piped (not supported)
      if (!process.stdin.isTTY) {
        console.error(
          'e2b: warning: stdin piping is not supported, input will be ignored'
        )
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
    timeoutMs: opts.timeout,
    onStdout: (data) => {
      process.stdout.write(data)
    },
    onStderr: (data) => {
      process.stderr.write(data)
    },
  })

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
  // Only replace technical terms unlikely to appear in normal text
  if (err instanceof InvalidArgumentError) {
    let message = err.message
    message = message.replace(/\btimeout\b/g, '--timeout')

    console.error(`e2b: ${message}`)
    process.exit(1)
  }

  // Generic error - translate common SDK params to CLI flags
  const errMessage = err instanceof Error ? err.message : String(err)
  let message = errMessage
  message = message.replace(/\btimeout\b/gi, '--timeout')

  console.error(`e2b: ${message}`)
  process.exit(1)
}
